import Redis from 'ioredis';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testRedisConnection() {
    console.log('🧪 Probando conexión a Redis...');

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ REDIS_URL no está definido en .env');
        process.exit(1);
    }

    // Ocultar password en logs
    const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`🔌 Conectando a: ${maskedUrl}`);

    try {
        const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
        });

        redis.on('error', (err) => {
            console.error('❌ Error de conexión Redis:', err.message);
        });

        await new Promise<void>((resolve, reject) => {
            redis.on('connect', () => {
                console.log('✅ Conexión establecida exitosamente');
                resolve();
            });
            redis.on('error', (err) => reject(err));
        });

        // Prueba de escritura/lectura
        console.log('📝 Escribiendo clave de prueba...');
        await redis.set('test-key', 'plentypay-connected');

        console.log('📖 Leyendo clave de prueba...');
        const value = await redis.get('test-key');

        if (value === 'plentypay-connected') {
            console.log('✅ Prueba de lectura/escritura exitosa');
        } else {
            console.error('❌ El valor leído no coincide');
        }

        // Limpieza
        await redis.del('test-key');
        await redis.quit();
        console.log('👋 Conexión cerrada');

    } catch (error) {
        console.error('❌ Falló la prueba de Redis:', error);
        process.exit(1);
    }
}

testRedisConnection();
