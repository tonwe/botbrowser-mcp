/**
 * Playwright 浏览器实例管理器
 */
import { chromium, Browser, BrowserContext } from 'playwright';
import { ProfileRepository } from '../db/repositories/profile.js';
import { InstanceRepository } from '../db/repositories/instance.js';
import { AccountRepository } from '../db/repositories/account.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 用户数据目录，与数据库在同一位置
const USER_DATA_BASE_DIR = path.join(os.homedir(), '.botbrowser-mcp', 'user-data');

interface ManagedInstance {
  id: number;
  context: BrowserContext;
  profileAlias: string;
  accountId?: number;
  userDataDir: string; // 每个实例的独立用户数据目录
}

export class PlaywrightManager {
  private instances: Map<number, ManagedInstance> = new Map();
  private profileRepo = new ProfileRepository();
  private instanceRepo = new InstanceRepository();
  private accountRepo = new AccountRepository();

  /**
   * 启动浏览器实例
   */
  async launchInstance(profileAlias: string, accountId?: number, launchOptions?: any): Promise<number> {
    const profile = this.profileRepo.getByAlias(profileAlias);
    if (!profile) {
      throw new Error(`浏览器配置不存在: ${profileAlias}`);
    }

    // 检查该 profile 是否已有运行中的实例（同一指纹不能多开）
    const existingInstance = Array.from(this.instances.values()).find(
      inst => inst.profileAlias === profileAlias
    );
    if (existingInstance) {
      throw new Error(`Profile "${profileAlias}" already has a running instance (ID: ${existingInstance.id}). Cannot launch multiple instances with the same fingerprint.`);
    }

    // 验证账号
    if (accountId) {
      const account = this.accountRepo.getById(accountId);
      if (!account || account.profile_alias !== profileAlias) {
        throw new Error(`账号 ${accountId} 不属于配置 ${profileAlias}`);
      }
    }

    // 使用固定的 userDataDir（每个 profile 一个目录）
    let userDataDir = profile.user_data_dir;
    
    // 如果数据库中没有 userDataDir，创建并保存
    if (!userDataDir) {
      userDataDir = path.join(USER_DATA_BASE_DIR, profileAlias);
      await fs.mkdir(USER_DATA_BASE_DIR, { recursive: true });
      this.profileRepo.updateUserDataDir(profileAlias, userDataDir);
    } else {
      // 确保目录的父目录存在
      await fs.mkdir(path.dirname(userDataDir), { recursive: true });
    }
    
    // 使用传入的 launchOptions，如果没有则使用默认值
    const options: any = launchOptions || {};

    // 确保有基本的 args 数组
    if (!options.args) {
      options.args = [];
    }
    // 添加基本参数（如果还没有的话）
    if (!options.args.includes('--no-first-run')) {
      options.args.push('--no-first-run', '--no-default-browser-check');
    }

    // 防指纹参数
    if (profile.fingerprint_path) {
      options.args.push(`--bot-profile=${profile.fingerprint_path}`);
    }

    // 代理配置（profile 中的代理优先级更高）
    if (profile.proxy_server) {
      options.proxy = {
        server: profile.proxy_server,
      };
      if (profile.proxy_username) {
        options.proxy.username = profile.proxy_username;
        options.proxy.password = profile.proxy_password || '';
      }
      if (profile.proxy_bypass) {
        options.proxy.bypass = profile.proxy_bypass;
      }
    }

    // 设置默认 viewport（如果配置中没有指定）
    if (!options.viewport) {
      options.viewport = { width: 1280, height: 720 };
    }

    // 如果配置指定了 storage_state_path，尝试加载
    if (profile.storage_state_path) {
      try {
        await fs.access(profile.storage_state_path);
        options.storageState = profile.storage_state_path;
      } catch {
        // 文件不存在，使用默认空状态
      }
    }

    // 使用 launchPersistentContext 启动（支持 userDataDir）
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: profile.executable_path,
      ...options, // launchOptions 中可以包含 headless、channel 等配置
    });

    // 确保至少有一个页面存在
    if (context.pages().length === 0) {
      await context.newPage();
    }

    // 保存到数据库
    const instanceId = this.instanceRepo.create({
      profile_alias: profileAlias,
      account_id: accountId,
      is_active: this.instances.size === 0 ? 1 : 0, // 第一个实例自动激活
    });

    // 保存到内存
    this.instances.set(instanceId, {
      id: instanceId,
      context,
      profileAlias,
      accountId,
      userDataDir,
    });

    // 如果是第一个实例，设置为活跃
    if (this.instances.size === 1) {
      this.instanceRepo.setActive(instanceId);
    }

    // 更新配置的最后使用时间
    this.profileRepo.updateLastUsed(profileAlias);

    return instanceId;
  }

  /**
   * 切换活跃实例
   */
  async switchActive(instanceId: number): Promise<void> {
    if (!this.instances.has(instanceId)) {
      throw new Error(`实例 ${instanceId} 不存在`);
    }

    this.instanceRepo.setActive(instanceId);
  }

  /**
   * 停止实例
   */
  async stopInstance(instanceId: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`实例 ${instanceId} 不存在`);
    }

    // 保存 storageState（如果配置指定了路径）
    const profile = this.profileRepo.getByAlias(instance.profileAlias);
    if (profile && profile.storage_state_path) {
      const storageState = await instance.context.storageState();
      await fs.writeFile(profile.storage_state_path, JSON.stringify(storageState, null, 2));
    }

    // 关闭浏览器
    await instance.context.close();

    // 注意：不再删除 userDataDir，保留以便下次使用

    // 从内存和数据库删除
    this.instances.delete(instanceId);
    this.instanceRepo.delete(instanceId);

    // 如果删除的是活跃实例，激活第一个可用实例
    const activeInstance = this.instanceRepo.getActive();
    if (!activeInstance && this.instances.size > 0) {
      const firstId = this.instances.keys().next().value as number | undefined;
      if (firstId !== undefined) {
        this.instanceRepo.setActive(firstId);
      }
    }
  }

  /**
   * 停止所有实例
   */
  async stopAll(): Promise<void> {
    const ids = Array.from(this.instances.keys());
    for (const id of ids) {
      await this.stopInstance(id);
    }
  }

  /**
   * 获取活跃实例的上下文
   */
  getActiveContext(): BrowserContext | null {
    const activeInstance = this.instanceRepo.getActive();
    if (!activeInstance) {
      return null;
    }

    const instance = this.instances.get(activeInstance.id);
    if (!instance) {
      return null;
    }
    
    this.instanceRepo.updateLastActive(activeInstance.id);
    return instance.context;
  }

  /**
   * 获取所有实例列表
   */
  listInstances() {
    return Array.from(this.instances.values()).map(inst => ({
      id: inst.id,
      profile_alias: inst.profileAlias,
      account_id: inst.accountId,
      is_active: this.instanceRepo.getActive()?.id === inst.id,
    }));
  }

  /**
   * 清理已停止的实例记录（实例在内存中不存在但数据库有记录）
   */
  async cleanupOrphaned(): Promise<number> {
    const dbInstances = this.instanceRepo.getAll();
    let cleaned = 0;

    for (const dbInst of dbInstances) {
      if (!this.instances.has(dbInst.id)) {
        this.instanceRepo.delete(dbInst.id);
        cleaned++;
      }
    }

    return cleaned;
  }
}
