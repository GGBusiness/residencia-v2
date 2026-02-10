-- SQL para adicionar campos phone e age na tabela users

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER;
