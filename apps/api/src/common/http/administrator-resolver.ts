export interface AdministratorIdentity {
  id: string;
  email: string;
  displayName: string;
}

export interface AdministratorResolver {
  resolveCurrentAdministrator(): Promise<AdministratorIdentity>;
}

/** Inversion point that keeps the shared guard independent from Access internals. */
export const ADMINISTRATOR_RESOLVER = Symbol('ADMINISTRATOR_RESOLVER');
