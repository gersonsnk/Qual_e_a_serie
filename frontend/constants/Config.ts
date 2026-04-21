import { Platform } from 'react-native';

const DEFAULT_IP = "192.168.100.159";
const STORAGE_KEY = "GAME_SERVER_IP";

/**
 * Gerencia a URL da API de forma dinâmica.
 * No Web usa localStorage, no Mobile tenta usar o valor salvo ou o padrão.
 */
class ApiConfig {
    private static currentIp: string = DEFAULT_IP;

    static async load() {
        if (Platform.OS === 'web') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) this.currentIp = saved;
        }
        // Para Mobile, como ainda não temos AsyncStorage instalado, 
        // ficaremos com o padrão ou o valor da sessão.
        return this.getApiUrl();
    }

    static getApiUrl() {
        return `http://${this.currentIp}:8000`;
    }

    static setIp(newIp: string) {
        this.currentIp = newIp.replace("http://", "").replace(":8000", "").trim();
        if (Platform.OS === 'web') {
            localStorage.setItem(STORAGE_KEY, this.currentIp);
        }
    }

    static getRawIp() {
        return this.currentIp;
    }
}

export default ApiConfig;
