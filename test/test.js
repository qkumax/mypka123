// Импортируем необходимые модули динамически
const importChai = import('chai');
const importChaiHttp = import('chai-http');

// Объявляем асинхронную функцию для выполнения тестов
async function runTests() {
  const chai = await importChai;
  const chaiHttp = await importChaiHttp;

  // Использование chai и chai-http
  chai.default.use(chaiHttp.default);

  const { expect } = chai.default;

  describe('Doctors API', function() {
    let createdDoctorIds = [];

    // Создание нескольких докторов
    describe('POST /doctors', function() {
      it('should create multiple doctors', async function() {
        this.timeout(10000); // Увеличиваем таймаут

        const doctors = [
          { name: "Dr. John Doe", specialization: "Cardiology" },
          { name: "Dr. Jane Smith", specialization: "Neurology" },
          { name: "Dr. William Black", specialization: "Pediatrics" }
        ];

        for (const doctor of doctors) {
          const res = await chai.default.request('http://localhost:4000')
            .post('/doctors')
            .send(doctor);
          
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('_id');
          createdDoctorIds.push(res.body._id); // Сохраняем ID
        }
      });
    });

    // Удаление созданных докторов
    describe('DELETE /doctors/:id', function() {
      it('should delete the created doctors', async function() {
        this.timeout(10000); // Увеличиваем таймаут

        for (const doctorId of createdDoctorIds) {
          const res = await chai.default.request('http://localhost:4000')
            .delete(`/doctors/${doctorId}`);
          
          expect(res).to.have.status(200);
        }
      });
    });
  });

  // Запускаем тесты
  run();
}

// Вызываем асинхронную функцию для запуска тестов
runTests();
