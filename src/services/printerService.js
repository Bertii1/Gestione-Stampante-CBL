/**
 * Printer Service
 * Servizio per la gestione della stampante via Telnet
 */
import { Telnet } from 'telnet-client';
import { config } from '../config/app.js';
import { logger } from '../utils/logger.js';
import { PrinterError } from '../utils/errors.js';

class PrinterService {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = config.printer.retryAttempts || 1;
    this.retryDelay = config.printer.retryDelay || 2000;
  }
  /**
   * stampa il comando specificato
   * @param {string} command - Comando di stampa da inviare
   * @param {number} quantity - Quantità di copie da stampare
   * @returns {void}
   **/
  async Print(command,quantity) {
    const connection = new Telnet();
  
  try {
    console.log('Connessione alla stampante...');
    console.log(`Host: ${config.printer.host}:${config.printer.port}`);
    
    await connection.connect({
      host: config.printer.host,
      port: config.printer.port,
      timeout: 30000,
      negotiationMandatory: false
    });
    
    console.log('✅ Connesso alla stampante!');
    console.log(`\nInviando comando: ${command}`);
    
    // Invia il comando principale
    await new Promise((resolve, reject) => {
      const socket = connection.socket;
      
      if (!socket || !socket.writable) {
        reject(new Error('Socket non disponibile'));
        return;
      }
      
      socket.write(`${command}\r\n`, (error) => {
        if (error) {
          reject(new Error(`Errore invio comando principale: ${error.message}`));
          return;
        }
        console.log('✅ Comando principale inviato');
        
        // Invia comando di stampa dopo delay
        setTimeout(() => {
          socket.write(`P1,1\r\n`, (error) => {
            if (error) {
              reject(new Error(`Errore invio comando stampa: ${error.message}`));
              return;
            }
            console.log(`✅ Comando stampa P1,${quantity} inviato`);
            resolve();
          });
        }, 200);
      });
    });
    } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  } finally {
    connection.destroy;
    console.log('Connessione chiusa');
  }
  }
  
  /**
   * Valida comando di stampa
   */
  validatePrintCommand(command) {
    if (!command || typeof command !== 'string') {
      throw new PrinterError('Print command must be a non-empty string');
    }

    const trimmedCommand = command.trim();
    if (trimmedCommand.length === 0) {
      throw new PrinterError('Print command cannot be empty');
    }

    // Basic command format validation
    const validCommands = ['B1', 'B2', 'IMG', 'T', 'A', 'R'];
    const commandStart = trimmedCommand.substring(0, 3);
    
    if (!validCommands.some(cmd => trimmedCommand.startsWith(cmd))) {
      logger.warn('Potentially invalid print command', {
        command: commandStart,
        validCommands
      });
    }

    return trimmedCommand;
  }

  /**
   * Formatta comando per logging sicuro
   */
  safeCommandString(command, maxLength = 100) {
    if (!command) return 'NO_COMMAND';
    
    const safe = command.substring(0, maxLength);
    return safe + (command.length > maxLength ? '...' : '');
  }
}

// Singleton instance
const printerService = new PrinterService();

export { printerService };
export default printerService;