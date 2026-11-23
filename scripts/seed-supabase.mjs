#!/usr/bin/env node
/**
 * Carga los datos demo de mockup/js/data.js en Supabase.
 *
 * Uso:
 *   node scripts/seed-supabase.mjs
 *
 * Lee SUPABASE_URL y SUPABASE_SECRET_KEY desde .env (o del entorno).
 * Es idempotente: usa upsert por id.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env');
const DATA_FILE = path.join(ROOT, 'mockup', 'js', 'data.js');

function loadEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = { ...loadEnv(ENV_FILE), ...process.env };
const SUPABASE_URL = (env.SUPABASE_URL || '').replace(/\/+$/, '');
// El REST legado acepta el service_role JWT; la `secret key` nueva queda
// reservada para SDKs que implementen el esquema sb_secret_*.
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';

if (!SUPABASE_URL || !SECRET) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env o en el entorno.');
  process.exit(2);
}

function normalizeEmailPart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function loadDemoData() {
  const context = {
    console,
    AUTEC: { utils: { normalizeEmailPart } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DATA_FILE, 'utf8'), context, { filename: DATA_FILE });
  if (!context.AUTEC || !context.AUTEC.data) {
    throw new Error('No se pudo cargar AUTEC.data desde mockup/js/data.js');
  }
  return context.AUTEC.data;
}

const MONTHS = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

function parseSpanishDate(value, fallback = new Date()) {
  if (!value) return fallback.toISOString();
  const match = String(value).match(/(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})(?:\s*·\s*(\d{1,2}):(\d{2}))?/i);
  if (!match) return fallback.toISOString();
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
  const year = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 12;
  const minute = match[5] ? Number(match[5]) : 0;
  if (month === undefined) return fallback.toISOString();
  return new Date(year, month, day, hour, minute, 0).toISOString();
}

function todayAt(time) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  const now = new Date();
  if (!match) return now.toISOString();
  now.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return now.toISOString();
}

function dateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? value : null;
}

function uniqueBy(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    const value = row[key];
    if (value === undefined || value === null) return true;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function upsert(table, rows, onConflict = 'id') {
  if (!rows.length) {
    console.log(`- ${table}: 0 filas`);
    return;
  }
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${table} respondio ${response.status}: ${detail}`);
  }
  console.log(`- ${table}: ${rows.length} filas`);
}

async function main() {
  const data = loadDemoData();

  const plans = data.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    period: plan.period,
    billing: plan.billing,
    seats: plan.seats,
    duration_days: plan.durationDays,
    skills: plan.skills || [],
    color: plan.color,
    description: plan.description,
  }));

  const companies = data.companies.map((company) => ({
    id: company.id,
    name: company.name,
    short: company.short,
    sector: company.sector,
    status: company.status,
    plan_id: company.planId,
    seats: company.seats,
    users_count: company.usersCount,
    expires_at: dateOnly(company.expiresAt),
    created_at: dateOnly(company.createdAt),
    contact: company.contact,
    email: company.email,
    phone: company.phone,
    skills: company.skills || [],
    last_activity: company.lastActivity,
    mrr: company.mrr,
    color: company.color,
    domain: company.domain,
  }));

  const skills = data.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    short: skill.short,
    status: skill.status,
    group_name: skill.group,
    description: skill.description,
    industries: skill.industries || [],
    icon: skill.icon,
    progress: skill.progress,
    global_active: Boolean(skill.globalActive),
    companies_using: skill.companiesUsing || 0,
    featured: Boolean(skill.featured),
    pilot: Boolean(skill.pilot),
  }));

  const creator = {
    id: data.creator.id || 'u-creator',
    company_id: null,
    name: data.creator.name,
    email: data.creator.email,
    role: 'creator',
    status: 'active',
    last_access: 'Ahora',
  };

  const profiles = uniqueBy(
    [creator].concat(
      data.users.map((user) => ({
        id: user.id,
        company_id: user.companyId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        last_access: user.lastAccess,
      }))
    ),
    'email'
  );

  const companySkills = [];
  for (const company of data.companies) {
    for (const skillId of company.skills || []) {
      companySkills.push({
        company_id: company.id,
        skill_id: skillId,
        enabled: true,
        config: {},
      });
    }
  }

  const requests = data.requests.map((request, index) => ({
    id: request.id,
    type: request.type,
    company_id: request.companyId || null,
    company_name: request.companyName,
    skill_id: request.skillId || null,
    detail: request.detail,
    status: request.status,
    created_at: new Date(Date.now() - (index + 1) * 36 * 60 * 1000).toISOString(),
  }));

  const sessions = data.sessions.map((session) => ({
    id: session.id,
    profile_id: session.userId,
    company_id: session.companyId,
    user_name: session.userName,
    company_name: session.companyName,
    role: session.role,
    ip: session.ip,
    started_at: todayAt(session.startedAt),
    last_seen: new Date().toISOString(),
  }));

  const audit = data.audit.map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    action: entry.action,
    action_type: entry.actionType,
    target: entry.target,
    company_id: entry.companyId || null,
    company_name: entry.companyName,
    ip: entry.ip,
    created_at: parseSpanishDate(entry.date),
  }));

  const notifications = data.notifications.map((item) => ({
    id: item.id,
    profile_id: null,
    company_id: null,
    title: item.title,
    body: item.text,
    type: item.type,
    unread: Boolean(item.unread),
  }));

  const payments = [];
  for (const company of data.companies) {
    for (const payment of company.payments || []) {
      payments.push({
        id: `${company.id}-${payment.date.replace(/\s+/g, '-')}`,
        company_id: company.id,
        concept: payment.concept,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        paid_at: parseSpanishDate(payment.date).slice(0, 10),
      });
    }
  }

  console.log(`Sembrando ${SUPABASE_URL} ...`);
  await upsert('plans', plans);
  await upsert('companies', companies);
  await upsert('skills', skills);
  await upsert('profiles', profiles);
  await upsert('company_skills', companySkills, 'company_id,skill_id');
  await upsert('access_requests', requests);
  await upsert('sessions', sessions);
  await upsert('audit_log', audit);
  await upsert('notifications', notifications);
  await upsert('payments', payments);
  console.log('Listo.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
