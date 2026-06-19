import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class MakeMoveReqDto {
    @Type(() => Number)
    @IsInt()
    @IsNotEmpty()
    gameId: number;

    @IsNotEmpty()
    @IsString()
    from: string;

    @IsNotEmpty()
    @IsString()
    to: string;

    @IsString()
    promotion: string;
}