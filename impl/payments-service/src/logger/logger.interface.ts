/////////////////////////////////////////////////////////////////////////
//  The tiny surface every logger provider must implement. Callers depend
//  only on this — never on the underlying library — so providers can be
//  swapped from configuration without touching application code.
/////////////////////////////////////////////////////////////////////////

export interface ILogger {

    info(str: string): void;

    error(str: string): void;

    warn(str: string): void;

    debug(str: string): void;

}
