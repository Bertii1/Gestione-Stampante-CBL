
import { Telnet } from 'telnet-client';
import { config } from './src/config/app.js';

async function testPrinterCommand() {
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
    
    const command = "B20,0,Q,2,L,4,0,'dioacìabdsua'";
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
            console.log('✅ Comando stampa P1,1 inviato');
            resolve();
          });
        }, 200);
      });
    });
    } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
  } finally {
    connection.destroy();
    console.log('Connessione chiusa');
  }
}

testPrinterCommand();