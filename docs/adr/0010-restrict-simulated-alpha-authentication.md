# Restrict simulated alpha authentication

The Data Studio alpha may simulate one Administrator identity only in local
development or an infrastructure-protected private alpha environment. The
simulation must remain behind the authentication boundary and be visibly
configured, and the API must fail to start if simulated authentication is
enabled for a public production deployment; any publicly reachable Data Studio
requires real authentication regardless of its release label.
