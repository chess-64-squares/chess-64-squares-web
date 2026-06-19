import { GameStatus } from "../../enum/game-status.enum";
import { ReasonForEnding } from "../../enum/reason-for-ending.enum";
import { UserResDto } from "../user/user-res.dto";
import { GameModeResDto } from "./game-mode-res.dto";

export class GameResDto {
    gameId: number;
    playerWhite: UserResDto;
    playerBlack: UserResDto;
    gameMode: GameModeResDto;
    fen: string;
    status: GameStatus;
    reasonForEnding: ReasonForEnding | null;
    date: Date;
}