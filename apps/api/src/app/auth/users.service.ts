import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { Model } from 'mongoose';

import { UserEntity, UserDocument } from './user.schema';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(UserEntity.name)
    private readonly users: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.users.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get<boolean>('SEED_DEMO_USER', false)) {
      return;
    }

    const email = this.config.getOrThrow<string>('DEMO_USER_EMAIL').toLowerCase();
    const password = this.config.getOrThrow<string>('DEMO_USER_PASSWORD');
    const displayName = this.config.get<string>('DEMO_USER_NAME', 'Demo Reader');
    const existing = await this.findByEmail(email);

    if (existing) {
      return;
    }

    await this.users.create({
      email,
      displayName,
      passwordHash: await hash(password, 12),
    });
    this.logger.log(`Seeded demo application user ${email}`);
  }
}
