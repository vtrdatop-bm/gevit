-- Migration: Adiciona o valor 'cancelado' ao enum process_status
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'cancelado';
