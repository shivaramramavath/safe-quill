import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { SavedSession } from '@safe-quill/shared';
import { SavedSessionService } from '../../application/services/saved-session.service';
import { RenameSessionDto, SaveSessionDto } from '../../application/dtos/auth.dto';
import { JwtAuthGuard } from '../http/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../http/decorators/current-user.decorator';

@Controller('api/v1/sessions/saved')
@UseGuards(JwtAuthGuard)
export class SavedSessionController {
  constructor(private readonly savedSessionService: SavedSessionService) {}

  @Get()
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SavedSession[]> {
    return this.savedSessionService.list(user.id);
  }

  @Post()
  async saveSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SaveSessionDto,
  ): Promise<SavedSession> {
    return this.savedSessionService.save(user.id, dto);
  }

  @Patch(':id')
  async renameSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: RenameSessionDto,
  ): Promise<SavedSession> {
    return this.savedSessionService.rename(user.id, id, dto.title);
  }

  @Delete(':id')
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const deleted = await this.savedSessionService.delete(user.id, id);
    return { success: deleted };
  }
}
