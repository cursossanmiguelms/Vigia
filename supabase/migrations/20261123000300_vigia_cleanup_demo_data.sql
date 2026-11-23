-- VigIA · limpieza de datos de prueba
-- Se conservan planes y skills como catálogo inicial de configuración.
-- Se eliminan empresas, usuarios, solicitudes, sesiones, auditoría, pagos,
-- notificaciones, cámaras, zonas, configuraciones y evidencia ficticia.

delete from public.app_configs;
delete from public.alert_events;
delete from public.monitoring_metrics;
delete from public.captures;
delete from public.company_skills;
delete from public.notifications;
delete from public.audit_log;
delete from public.sessions;
delete from public.access_requests;
delete from public.payments;
delete from public.profiles where id <> 'u-creator';
delete from public.cameras;
delete from public.zones;
delete from public.companies;

update public.profiles
set email = 'admin@vigia.local',
    name = 'Administrador',
    role = 'creator',
    status = 'active'
where id = 'u-creator';
