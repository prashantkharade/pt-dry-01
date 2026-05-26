/////////////////////////////////////////////////////////////////////////
//  Time helpers — keep call sites timezone-aware (Asia/Kolkata) without
//  pulling in heavier libraries unless needed.
/////////////////////////////////////////////////////////////////////////

export class TimeUtils {

    public static today = (): string => {
        return new Date().toISOString().slice(0, 10);
    };

    public static now = (): Date => new Date();

    public static addSeconds = (seconds: number, from: Date = new Date()): Date => {
        return new Date(from.getTime() + seconds * 1000);
    };

    public static toIsoString = (d: Date): string => d.toISOString();
}
