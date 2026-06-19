import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class FindMatchReqDto {
    @Type(() => Number)
    @IsInt()
    gameModeId: number;
}