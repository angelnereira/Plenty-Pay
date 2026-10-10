export class AppError extends Error {
    constructor(public message: string, public code: string) {
        super(message);
    }
}
