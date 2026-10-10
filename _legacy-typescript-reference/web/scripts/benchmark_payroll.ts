
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function benchmark() {
  const EMPLOYEES_COUNT = 50;
  const SHIFTS_PER_EMPLOYEE = 10;
  const DB_LATENCY_MS = 5; // Low latency to simulate fast DB, but network overhead applies

  console.log(`Starting Benchmark: ${EMPLOYEES_COUNT} Employees, ${SHIFTS_PER_EMPLOYEE} Shifts/Emp, ${DB_LATENCY_MS}ms DB Latency`);

  // Mock Data
  const employees = Array.from({ length: EMPLOYEES_COUNT }, (_, i) => ({
    id: `emp_${i}`,
    hourlyRate: 10
  }));

  // ==========================================
  // N+1 APPROACH (CURRENT)
  // ==========================================
  console.log('\n--- Running N+1 Approach ---');
  const startN1 = performance.now();

  // 1. Get Employees
  await delay(DB_LATENCY_MS);

  // 2. Init Run
  await delay(DB_LATENCY_MS);

  // 3. Process Each
  for (const emp of employees) {
    // Fetch Shifts (N+1)
    await delay(DB_LATENCY_MS);

    // Simulate Processing
    const shifts = Array.from({ length: SHIFTS_PER_EMPLOYEE }, () => ({ regularHours: 8 }));

    // Save Item (N+1)
    await delay(DB_LATENCY_MS);
  }

  // 4. Update Run
  await delay(DB_LATENCY_MS);

  const endN1 = performance.now();
  const timeN1 = endN1 - startN1;
  console.log(`N+1 Time: ${timeN1.toFixed(2)}ms`);


  // ==========================================
  // OPTIMIZED APPROACH
  // ==========================================
  console.log('\n--- Running Optimized Approach ---');
  const startOpt = performance.now();

  // 1. Get Employees
  await delay(DB_LATENCY_MS);

  // 2. Init Run
  await delay(DB_LATENCY_MS);

  // 3. Fetch All Shifts (1 Query)
  await delay(DB_LATENCY_MS);
  // Grouping overhead (negligible but simulated)
  const allShifts = new Map();
  for(const emp of employees) {
    allShifts.set(emp.id, Array.from({ length: SHIFTS_PER_EMPLOYEE }, () => ({ regularHours: 8 })));
  }

  const payrollItems = [];

  // 4. Process Loop (In Memory)
  for (const emp of employees) {
    const shifts = allShifts.get(emp.id) || [];
    // Processing...
    payrollItems.push({ employeeId: emp.id, amount: 1000 });
  }

  // 5. Save Items (Batch)
  await delay(DB_LATENCY_MS); // createMany

  // 6. Update Run
  await delay(DB_LATENCY_MS);

  const endOpt = performance.now();
  const timeOpt = endOpt - startOpt;
  console.log(`Optimized Time: ${timeOpt.toFixed(2)}ms`);

  // ==========================================
  // RESULTS
  // ==========================================
  console.log('\n--- Results ---');
  console.log(`Improvement: ${(timeN1 / timeOpt).toFixed(1)}x faster`);
}

benchmark();
