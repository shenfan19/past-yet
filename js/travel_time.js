export const officeStay = (D, days) => Math.max(1, Math.min(days, D.get('config.travel.max_office_days')));
export const historicalDays = (D, days) => officeStay(D, days) * D.get('config.travel.history_days_per_office_day');
