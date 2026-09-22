import { getDatabase } from '../db/sqlite.js';

export class ProfileRepository {
  static findByUserId(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || null;
  }

  static upsert(userId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(userId);

    const displayName = data.displayName || data.display_name || null;
    const gender = data.gender || null;
    const maritalStatus = data.maritalStatus || data.marital_status || null;
    const phoneNumber = data.phoneNumber || data.phone_number || null;
    const city = data.city || null;
    const state = data.state || null;
    const occupationType = data.occupationType || data.occupation_type || null;
    const employerOrBusinessName = data.employerOrBusinessName || data.employer_or_business_name || null;
    const jobTitleOrBusinessType = data.jobTitleOrBusinessType || data.job_title_or_business_type || null;
    const employmentStartYear = data.employmentStartYear !== undefined ? data.employmentStartYear : (data.employment_start_year || null);
    const monthlyLifestyleExpenses = data.monthlyLifestyleExpenses ? String(data.monthlyLifestyleExpenses) : (data.monthly_lifestyle_expenses ? String(data.monthly_lifestyle_expenses) : null);

    if (existing) {
      db.prepare(`
        UPDATE profiles SET
          full_name = ?,
          date_of_birth = ?,
          dependents = ?,
          retirement_age = ?,
          risk_profile = ?,
          city_tier = ?,
          monthly_expense = ?,
          display_name = ?,
          gender = ?,
          marital_status = ?,
          phone_number = ?,
          city = ?,
          state = ?,
          occupation_type = ?,
          employer_or_business_name = ?,
          job_title_or_business_type = ?,
          employment_start_year = ?,
          monthly_lifestyle_expenses = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(
        data.fullName || data.full_name,
        data.dateOfBirth || data.date_of_birth,
        data.dependents !== undefined ? data.dependents : 0,
        data.retirementAge || data.retirement_age || 60,
        data.riskProfile || data.risk_profile || 'MODERATE',
        data.cityTier || data.city_tier || 'TIER_1',
        data.monthlyExpense ? String(data.monthlyExpense) : (data.monthly_expense ? String(data.monthly_expense) : null),
        displayName,
        gender,
        maritalStatus,
        phoneNumber,
        city,
        state,
        occupationType,
        employerOrBusinessName,
        jobTitleOrBusinessType,
        employmentStartYear,
        monthlyLifestyleExpenses,
        now,
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO profiles (
          user_id, full_name, date_of_birth, dependents, retirement_age,
          risk_profile, city_tier, monthly_expense, display_name, gender,
          marital_status, phone_number, city, state, occupation_type,
          employer_or_business_name, job_title_or_business_type, employment_start_year,
          monthly_lifestyle_expenses, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        data.fullName || data.full_name,
        data.dateOfBirth || data.date_of_birth,
        data.dependents !== undefined ? data.dependents : 0,
        data.retirementAge || data.retirement_age || 60,
        data.riskProfile || data.risk_profile || 'MODERATE',
        data.cityTier || data.city_tier || 'TIER_1',
        data.monthlyExpense ? String(data.monthlyExpense) : (data.monthly_expense ? String(data.monthly_expense) : null),
        displayName,
        gender,
        maritalStatus,
        phoneNumber,
        city,
        state,
        occupationType,
        employerOrBusinessName,
        jobTitleOrBusinessType,
        employmentStartYear,
        monthlyLifestyleExpenses,
        now,
        now
      );
    }

    return this.findByUserId(userId);
  }
}
