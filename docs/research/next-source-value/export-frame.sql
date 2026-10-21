-- One fixed, permitted source family. Contacts are deliberately not selected.
INSTALL httpfs;
LOAD httpfs;
SET s3_region = 'us-west-2';
SET threads = 4;
SET memory_limit = '1GB';

COPY (
  SELECT id, version, names, bbox, confidence, websites, socials,
    addresses, sources, operating_status, basic_category, taxonomy, filename
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/2026-09-23.1/theme=places/type=place/*',
    filename = true, hive_partitioning = 1
  )
  WHERE bbox.xmin BETWEEN 20.2 AND 29.8
    AND bbox.ymin BETWEEN 43.5 AND 48.3
    AND list_contains(taxonomy.hierarchy, 'lodging')
    AND list_contains(list_transform(addresses, a -> a.country), 'RO')
  ORDER BY id
) TO '__OUTPUT__' (FORMAT JSON, ARRAY true);
