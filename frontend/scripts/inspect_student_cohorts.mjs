import mysql from 'mysql2/promise';

async function inspectCohorts() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'grc_app',
    password: 'd_6ZUQStgSp_rTewuHcSPx9YSVSMKFNSdkPz3b8zl6o',
    database: 'grc_enrollment'
  });

  const [programs] = await conn.query(
    "SELECT id, code, name FROM programs WHERE status = 'active' ORDER BY id"
  );

  console.log(`Found ${programs.length} active programs:`);
  for (const prog of programs) {
    console.log(`\nProgram: ${prog.code} - ${prog.name}`);
    const years = prog.code === 'TCP' ? [1] : [1, 2, 3, 4];
    for (const year of years) {
      const [regular] = await conn.query(
        `SELECT sp.id, sp.student_number, u.email, sp.year_level
         FROM student_profiles sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.program_id = ? AND sp.year_level = ?
           AND (sp.enrollment_category = 'regular' OR sp.enrollment_category IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM academic_grades ag 
             WHERE ag.student_id = sp.user_id AND ag.mark IN ('5.00', 'DRP', 'INC', 'NC')
           )
         LIMIT 5`,
        [prog.id, year]
      );

      const [irregular] = await conn.query(
        `SELECT sp.id, sp.student_number, u.email, sp.year_level
         FROM student_profiles sp
         JOIN users u ON u.id = sp.user_id
         WHERE sp.program_id = ? AND sp.year_level = ?
           AND (
             sp.enrollment_category = 'irregular'
             OR EXISTS (
               SELECT 1 FROM academic_grades ag 
               WHERE ag.student_id = sp.user_id AND ag.mark IN ('5.00', 'DRP', 'INC', 'NC')
             )
           )
         LIMIT 5`,
        [prog.id, year]
      );

      console.log(`  Year ${year}: Regular candidates: ${regular.length}, Irregular candidates: ${irregular.length}`);
    }
  }

  await conn.end();
}

inspectCohorts().catch(console.error);

