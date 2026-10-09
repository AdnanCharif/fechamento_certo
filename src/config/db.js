import 'dotenv/config';
import { DatabasePool } from '../patterns/singleton/DatabasePool.js';

const pool = DatabasePool.getInstance();

export default pool;
