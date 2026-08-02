# REST, OpenAPI, and generated clients

The shared API will expose REST/JSON contracts described by an OpenAPI document,
and both client applications will consume a generated TypeScript client package.
OpenAPI generation and client verification must accompany contract changes;
clients may not import backend implementation DTOs or maintain parallel
handwritten request types, keeping the contract inspectable and available to
future non-TypeScript consumers.
