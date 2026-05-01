export type Language = 'en' | 'sv';

const translations = {
  sv: {
    header: { title: 'ValgACE Kontrollpanel', connectionLabel: 'Status', connected: 'Ansluten', disconnected: 'Frånkopplad', openFluidd: 'Öppna Fluidd' },
    cards: { deviceStatus: 'Enhetsstatus', dryer: 'Torkstyrning', slots: 'Filamentplatser', quickActions: 'Snabbåtgärder' },
    deviceInfo: { model: 'Modell', firmware: 'Firmware', status: 'Status', temp: 'Temperatur', fan: 'Fläkthastighet', rfid: 'RFID', rfidOn: 'Aktiverad', rfidOff: 'Inaktiverad' },
    dryer: {
      status: 'Status', targetTemp: 'Måltemperatur', duration: 'Inställd tid', remainingTime: 'Återstående tid', currentTemperature: 'Aktuell temperatur',
      inputs: { temp: 'Temperatur (°C):', duration: 'Varaktighet (min):' },
      buttons: { start: 'Starta torkning', stop: 'Stoppa torkning' },
      autoDryer: 'Auto-tork', autoDryerDesc: 'Startar automatiskt vid utskrift', autoStarted: 'Tork startad automatiskt',
    },
    slots: { slot: 'Plats', status: 'Status', type: 'Typ', sku: 'SKU', rfid: 'RFID' },
    quickActions: { unload: 'Ladda ur filament', stopAssist: 'Stoppa assist', refresh: 'Uppdatera status' },
    buttons: { load: 'Ladda', park: 'Parkera', assistOn: 'Assist PÅ', assistOff: 'Assist', feed: 'Mata', retract: 'Dra tillbaka' },
    dialogs: { feedTitle: 'Mata filament - Plats {slot}', retractTitle: 'Dra tillbaka filament - Plats {slot}', length: 'Längd (mm):', speed: 'Hastighet (mm/s):', execute: 'Utför', cancel: 'Avbryt' },
    notifications: {
      websocketConnected: 'WebSocket ansluten', websocketDisconnected: 'WebSocket frånkopplad',
      apiError: 'API-fel: {error}', loadError: 'Kunde inte ladda status: {error}',
      commandSuccess: 'Kommando {command} utfört', commandSent: 'Kommando {command} skickat',
      commandError: 'Fel: {error}', commandErrorGeneric: 'Kommandofel',
      executeError: 'Fel vid kommandokörning: {error}',
      feedAssistOn: 'Feed assist aktiverad för plats {index}', feedAssistOff: 'Feed assist inaktiverad för plats {index}',
      feedAssistAllOff: 'Feed assist inaktiverad för alla platser', feedAssistAllOffError: 'Kunde inte inaktivera feed assist',
      refreshStatus: 'Status uppdaterad',
      validation: { tempRange: 'Temperaturen måste vara mellan 20 och 55°C', durationMin: 'Varaktigheten måste vara minst 1 minut', feedLength: 'Längden måste vara minst 1 mm', retractLength: 'Längden måste vara minst 1 mm' },
    },
    statusMap: { ready: 'Redo', busy: 'Upptagen', unknown: 'Okänd', disconnected: 'Frånkopplad' },
    dryerStatusMap: { drying: 'Torkar', stop: 'Stoppad' },
    slotStatusMap: { ready: 'Redo', empty: 'Tom', busy: 'Upptagen', unknown: 'Okänd' },
    rfidStatusMap: { 0: 'Hittades inte', 1: 'Fel', 2: 'Identifierad', 3: 'Identifierar...' } as Record<number, string>,
    common: { unknown: 'Okänd' },
    time: { hours: 'h', minutes: 'min', minutesShort: 'm', secondsShort: 's' },
    config: { title: 'Anslutningsinställningar', apiBase: 'Moonraker API-adress (ACE)', placeholder: 'http://192.168.1.215:7125', printerApiBase: 'Moonraker API-adress (Skrivare)', printerPlaceholder: 'http://192.168.1.100:7125', cameraUrl: 'Kamera-URL', cameraPlaceholder: 'http://192.168.1.39:13619/monitor.jpg', spoolmanUrl: 'Spoolman URL', spoolmanPlaceholder: 'http://192.168.1.215:7912', save: 'Spara', description: 'Ange adresser för ACE, skrivare, kamera och Spoolman' },
    nav: { menu: 'Meny', dashboard: 'Dashboard', ace: 'ACE-kontroll', filament: 'Filamentlager', history: 'Utskriftshistorik', camera: 'Kamera', settings: 'Inställningar' },
    filament: { add: 'Lägg till', edit: 'Redigera rulle', brand: 'Märke', material: 'Material', color: 'Färg', weightTotal: 'Total vikt (g)', weightUsed: 'Använt (g)', remaining: 'Kvar', slotAssign: 'ACE-plats', notes: 'Anteckningar', empty: 'Inga filamentrullar registrerade', brandRequired: 'Märke krävs', added: 'Rulle tillagd', updated: 'Rulle uppdaterad', deleted: 'Rulle borttagen', active: 'Aktiv', setActive: 'Välj som aktiv', noSpoolman: 'Spoolman ej hittad. Konfigurera [spoolman] i moonraker.conf eller ange URL i inställningar.', location: 'Plats', vendor: 'Tillverkare' },
    history: { refresh: 'Uppdatera', empty: 'Ingen utskriftshistorik' },
    camera: { enterUrl: 'Ange kamerans snapshot-URL för att starta live-vy', start: 'Starta', stop: 'Stoppa', waiting: 'Väntar på kamerabild...', connecting: 'Ansluter till kamera...', unreachable: 'Kan inte nå kameran', retry: 'Försök igen' },
    printer: {
      temperatures: 'Temperaturer', name: 'Namn', power: 'Effekt', actual: 'Aktuell', target: 'Mål',
      printJob: 'Utskriftsjobb', elapsed: 'Förfluten tid', remaining: 'Återstår', speed: 'Hastighet', filamentUsed: 'Filament använt', lastFile: 'Senaste fil',
      fansOutputs: 'Fläktar & Utgångar',
      console: 'Konsol', clear: 'Rensa', consoleHint: 'Skriv G-code kommandon här...',
      noData: 'Väntar på data...',
      printerStatus: 'Skrivarstatus', printerConnected: 'Skrivare ansluten', printerDisconnected: 'Skrivare ej ansluten',
      states: { printing: 'Skriver ut', paused: 'Pausad', complete: 'Klar', cancelled: 'Avbruten', error: 'Fel', standby: 'Standby' },
      startPrint: 'Starta utskrift', pause: 'Pausa', resume: 'Återuppta', cancel: 'Avbryt',
      selectFile: 'Välj fil att skriva ut', searchFiles: 'Sök filer...', loadingFiles: 'Laddar filer...',
      noFiles: 'Inga gcode-filer hittades', confirmStart: 'Bekräfta start',
      printStarted: 'Utskrift startad', printPaused: 'Utskrift pausad', printResumed: 'Utskrift återupptagen', printCancelled: 'Utskrift avbruten',
    },
  },
  en: {
    header: { title: 'ValgACE Control Panel', connectionLabel: 'Status', connected: 'Connected', disconnected: 'Disconnected', openFluidd: 'Open Fluidd' },
    cards: { deviceStatus: 'Device Status', dryer: 'Dryer Control', slots: 'Filament Slots', quickActions: 'Quick Actions' },
    deviceInfo: { model: 'Model', firmware: 'Firmware', status: 'Status', temp: 'Temperature', fan: 'Fan Speed', rfid: 'RFID', rfidOn: 'Enabled', rfidOff: 'Disabled' },
    dryer: {
      status: 'Status', targetTemp: 'Target Temperature', duration: 'Set Duration', remainingTime: 'Remaining Time', currentTemperature: 'Current Temperature',
      inputs: { temp: 'Temperature (°C):', duration: 'Duration (min):' },
      buttons: { start: 'Start Drying', stop: 'Stop Drying' },
      autoDryer: 'Auto Dry', autoDryerDesc: 'Starts automatically when printing', autoStarted: 'Dryer started automatically',
    },
    slots: { slot: 'Slot', status: 'Status', type: 'Type', sku: 'SKU', rfid: 'RFID' },
    quickActions: { unload: 'Unload Filament', stopAssist: 'Stop Assist', refresh: 'Refresh Status' },
    buttons: { load: 'Load', park: 'Park', assistOn: 'Assist ON', assistOff: 'Assist', feed: 'Feed', retract: 'Retract' },
    dialogs: { feedTitle: 'Feed Filament - Slot {slot}', retractTitle: 'Retract Filament - Slot {slot}', length: 'Length (mm):', speed: 'Speed (mm/s):', execute: 'Execute', cancel: 'Cancel' },
    notifications: {
      websocketConnected: 'WebSocket connected', websocketDisconnected: 'WebSocket disconnected',
      apiError: 'API error: {error}', loadError: 'Status load error: {error}',
      commandSuccess: 'Command {command} executed successfully', commandSent: 'Command {command} sent',
      commandError: 'Error: {error}', commandErrorGeneric: 'Command execution error',
      executeError: 'Command execution error: {error}',
      feedAssistOn: 'Feed assist enabled for slot {index}', feedAssistOff: 'Feed assist disabled for slot {index}',
      feedAssistAllOff: 'Feed assist disabled for all slots', feedAssistAllOffError: 'Failed to disable feed assist',
      refreshStatus: 'Status refreshed',
      validation: { tempRange: 'Temperature must be between 20 and 55°C', durationMin: 'Duration must be at least 1 minute', feedLength: 'Length must be at least 1 mm', retractLength: 'Length must be at least 1 mm' },
    },
    statusMap: { ready: 'Ready', busy: 'Busy', unknown: 'Unknown', disconnected: 'Disconnected' },
    dryerStatusMap: { drying: 'Drying', stop: 'Stopped' },
    slotStatusMap: { ready: 'Ready', empty: 'Empty', busy: 'Busy', unknown: 'Unknown' },
    rfidStatusMap: { 0: 'Not found', 1: 'Error', 2: 'Identified', 3: 'Identifying...' } as Record<number, string>,
    common: { unknown: 'Unknown' },
    time: { hours: 'h', minutes: 'min', minutesShort: 'm', secondsShort: 's' },
    config: { title: 'Connection Settings', apiBase: 'Moonraker API Address (ACE)', placeholder: 'http://192.168.1.215:7125', printerApiBase: 'Moonraker API Address (Printer)', printerPlaceholder: 'http://192.168.1.100:7125', cameraUrl: 'Camera URL', cameraPlaceholder: 'http://192.168.1.39:13619/monitor.jpg', spoolmanUrl: 'Spoolman URL', spoolmanPlaceholder: 'http://192.168.1.215:7912', save: 'Save', description: 'Enter addresses for ACE, printer, camera and Spoolman' },
    nav: { menu: 'Menu', dashboard: 'Dashboard', ace: 'ACE Control', filament: 'Filament Inventory', history: 'Print History', camera: 'Camera', settings: 'Settings' },
    filament: { add: 'Add Spool', edit: 'Edit Spool', brand: 'Brand', material: 'Material', color: 'Color', weightTotal: 'Total Weight (g)', weightUsed: 'Used (g)', remaining: 'Remaining', slotAssign: 'ACE Slot', notes: 'Notes', empty: 'No filament spools registered', brandRequired: 'Brand is required', added: 'Spool added', updated: 'Spool updated', deleted: 'Spool deleted', active: 'Active', setActive: 'Set as active', noSpoolman: 'Spoolman not found. Configure [spoolman] in moonraker.conf or set URL in settings.', location: 'Location', vendor: 'Vendor' },
    history: { refresh: 'Refresh', empty: 'No print history' },
    camera: { enterUrl: 'Enter camera snapshot URL to start live view', start: 'Start', stop: 'Stop', waiting: 'Waiting for camera feed...', connecting: 'Connecting to camera...', unreachable: 'Cannot reach camera', retry: 'Retry' },
    printer: {
      temperatures: 'Temperatures', name: 'Name', power: 'Power', actual: 'Actual', target: 'Target',
      printJob: 'Print Job', elapsed: 'Elapsed', remaining: 'Remaining', speed: 'Speed', filamentUsed: 'Filament Used', lastFile: 'Last file',
      fansOutputs: 'Fans & Outputs',
      console: 'Console', clear: 'Clear', consoleHint: 'Type G-code commands here...',
      noData: 'Waiting for data...',
      printerStatus: 'Printer Status', printerConnected: 'Printer connected', printerDisconnected: 'Printer not connected',
      states: { printing: 'Printing', paused: 'Paused', complete: 'Complete', cancelled: 'Cancelled', error: 'Error', standby: 'Standby' },
      startPrint: 'Start Print', pause: 'Pause', resume: 'Resume', cancel: 'Cancel',
      selectFile: 'Select file to print', searchFiles: 'Search files...', loadingFiles: 'Loading files...',
      noFiles: 'No gcode files found', confirmStart: 'Confirm start',
      printStarted: 'Print started', printPaused: 'Print paused', printResumed: 'Print resumed', printCancelled: 'Print cancelled',
    },
    
  },
} as const;

export function t(lang: Language, path: string, params: Record<string, string | number> = {}): string {
  const keys = path.split('.');
  let value: unknown = translations[lang];
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (match, token) => {
      return token in params ? String(params[token]) : match;
    });
  }
  return path;
}
