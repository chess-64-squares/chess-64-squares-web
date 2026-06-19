import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class GameModeResDto {
    @Type(() => Number)
    @IsInt()
    gameModeId: number;
    gameModeName: string;
    @Type(() => Number)
    time: number;
    @Type(() => Number)
    plusPerMove: number;
}