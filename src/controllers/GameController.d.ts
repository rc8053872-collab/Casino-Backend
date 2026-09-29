import { Request, Response, NextFunction } from 'express';
export declare class GameController {
    static getCatalog(req: Request, res: Response, next: NextFunction): Promise<void>;
    static launchGame(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    static webhook(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=GameController.d.ts.map