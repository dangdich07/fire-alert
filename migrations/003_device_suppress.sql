ALTER TABLE devices
  ADD COLUMN suppress_until TIMESTAMP NULL AFTER status;
