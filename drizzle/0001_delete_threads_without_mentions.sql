-- Threads are now only stored once a group is mentioned in them, so drop the
-- rows that were stored for every other message.
DELETE FROM `threads`
WHERE CASE
  WHEN json_valid(`mentioned_groups`) THEN json_array_length(`mentioned_groups`) = 0
  ELSE 1
END;
