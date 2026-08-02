# Shared API as a modular monolith

The Recommendation Product and Data Studio will consume one shared backend API,
implemented as a single-deployment modular monolith. This keeps the initial
operational and agentic-work surface small while allowing contracts and
authorization to separate public recommendation capabilities from internal
research and curation capabilities; module boundaries will preserve the option
to extract services later if evidence justifies the added complexity.
