# External identity and internal authorization

After the Data Studio alpha, ELPA will delegate authentication to an external
OpenID Connect identity provider and will not store passwords. The API will
validate provider-issued identity tokens, while PostgreSQL remains authoritative
for invitations, Administrator membership, roles, authorization decisions, and
audit history so domain access rules stay explicit and the identity provider
remains replaceable.
