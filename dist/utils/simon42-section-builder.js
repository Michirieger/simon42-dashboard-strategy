// ====================================================================
// SECTION BUILDER - Erstellt Dashboard-Sections
// ====================================================================

/**
 * Erstellt die Übersichts-Section mit Zusammenfassungen
 */
export function createOverviewSection(data) {
  const { someSensorId, showSearchCard, showClockCard, config, hass } = data;
  
  const cards = [];

  // Prüfe ob Alarm-Entity konfiguriert ist
  const alarmEntity = config.alarm_entity;
  
  // Überschrift nur hinzufügen wenn Uhr oder Alarm-Panel angezeigt wird
  if (showClockCard || alarmEntity) {
    cards.push({
      type: "heading",
        heading: "Übersicht",
        heading_style: "title",
        icon: "mdi:overscan"
    });
  }

  // Nur die Uhr anzeigen
  if (showClockCard && !alarmEntity) {
    cards.push({
      type: "clock",
      clock_size: "small",
      show_seconds: false,
      grid_options: {
        columns: "full",
      }
    });
  }

  // AlarmPanel und bei auswahl auch Uhr nebeneinander
  if (alarmEntity && showClockCard) {
    cards.push({
      type: "tile",
      entity: alarmEntity,
      vertical: false
    });
    // Uhr bei auswahl anzeigen
    if (showClockCard) {
      cards.push({
        type: "clock",
        clock_size: "small",
        show_seconds: false,
      });
    }
  } 

  // Nur AlarmPanel
  if (alarmEntity && !showClockCard) {
    cards.push({
      type: "tile",
      entity: alarmEntity,
      vertical: false,
      grid_options: {
        columns: "full",
      }
    });
  }
  
  // Füge Search-Card hinzu wenn aktiviert
  if (showSearchCard) {
    cards.push({
      type: "custom:search-card",
      grid_options: {
        columns: "full",
      }
    });
  }

  // Prüfe ob summaries_columns konfiguriert ist (Standard: 2)
  const summariesColumns = config.summaries_columns || 2;
  const showCoversSummary = config.show_covers_summary !== false;
  const showSecuritySummary = config.show_security_summary !== false;
  const showBatterySummary = config.show_battery_summary !== false;
  const showLightSummary = config.show_light_summary !== false;

  // Fügt die Überschrift des Abschnitts "Zusammenfassungen" hinzu
  if (showCoversSummary || showSecuritySummary || showBatterySummary || showLightSummary) {
    cards.push({
      type: "heading",
      heading: "Zusammenfassungen"
    });
  }

  // Erstelle die Summary-Cards basierend auf Konfiguration
  // TODO Option hinzufügen
  const summaryCards = [];

  if (showLightSummary) {
    summaryCards.push({
        type: "custom:simon42-summary-card",
        summary_type: "lights",
        areas_options: config.areas_options || {}
      });
  }


  // Covers optional hinzufügen
  if (showCoversSummary) {
    summaryCards.push({
      type: "custom:simon42-summary-card",
      summary_type: "covers",
      areas_options: config.areas_options || {}
    });
  }

  // Security
  if (showSecuritySummary) {
  summaryCards.push(
    {
      type: "custom:simon42-summary-card",
      summary_type: "security",
      areas_options: config.areas_options || {}
    });
  }
   
  // Batery
  if (showBatterySummary) {
    summaryCards.push(
      {
        type: "custom:simon42-summary-card",
        summary_type: "batteries",
        areas_options: config.areas_options || {}
      }
    );
  }  

  // Layout-Logik: Dynamisch an Anzahl der Cards anpassen
  if (summariesColumns === 4) {
    // Bei 4 Spalten: Alle Cards in einer Reihe
    cards.push({
      type: "horizontal-stack",
      cards: summaryCards
    });
  } else {
    // Bei 2 Spalten: Aufteilen in mehrere Reihen à 2 Cards
    for (let i = 0; i < summaryCards.length; i += 2) {
      const rowCards = summaryCards.slice(i, i + 2);
      
      // Wenn nur eine Karte übrig (ungerade Anzahl), trotzdem horizontal-stack verwenden
      cards.push({
        type: "horizontal-stack",
        cards: rowCards
      });
    }
  }

  // Favoriten Section
  const favoriteEntities = (config.favorite_entities || [])
    .filter(entityId => hass.states[entityId] !== undefined);

  if (favoriteEntities.length > 0) {
    cards.push({
      type: "heading",
      heading: "Favoriten"
    });
    
    favoriteEntities.forEach(entityId => {
      cards.push({
        type: "tile",
        entity: entityId,
        show_entity_picture: true,
        vertical: false,
        state_content: "last_changed"
      });
    });
  }

  return {
    type: "grid",
    cards: cards
  };
}

/**
 * Erstellt die Bereiche-Section(s)
 * @param {Array} visibleAreas - Sichtbare Bereiche
 * @param {boolean} groupByFloors - Ob nach Etagen gruppiert werden soll
 * @param {Object} hass - Home Assistant Objekt (für Floor-Namen)
 */
export function createAreasSection(visibleAreas, groupByFloors = false, hass = null, config = {}) {
  
  // Hilfsfunktion: Mapping von Device-ID zu Area-ID
  const getDeviceAreaMap = () => {
    const map = new Map();
    if (hass && hass.devices) {
        Object.values(hass.devices).forEach(d => {
            if (d.area_id) map.set(d.id, d.area_id);
        });
    }
    return map;
  };

  const deviceAreaMap = getDeviceAreaMap();

  const createAreaCard = (area) => {
    const areaId = area.area_id;
    const areaOptions = config.areas_options?.[areaId] || {};
    
    // Die gewählten Sensoren
    const selectedTemp = areaOptions.sensor_temp;
    const selectedHum  = areaOptions.sensor_hum;
    const selectedVoc  = areaOptions.sensor_voc;
    
    const excludeList = [];
    const forceEntitiesList = [];

    // Haben wir manuelle Einstellungen?
    const hasManualSettings = selectedTemp || selectedHum || selectedVoc;

    if (hass && hass.entities) {
        const registryEntities = Object.values(hass.entities);
        
        // Alle Entities im Raum finden
        const roomEntities = registryEntities.filter(e => {
            if (e.area_id === areaId) return true;
            if (e.device_id || deviceAreaMap.get(e.device_id) === areaId) return true;
            return false;
        });

        if (hasManualSettings) {
            // 1. WHITELIST
            if (selectedTemp) forceEntitiesList.push(selectedTemp);
            if (selectedHum) forceEntitiesList.push(selectedHum);
            if (selectedVoc) forceEntitiesList.push(selectedVoc);

            // 2. BLACKLIST
            roomEntities.forEach(e => {
              const entityId = e.entity_id;
              const stateObj = hass.states[entityId];
              if (!stateObj) return;

              // Nur Sensoren betrachten
              if (!entityId.startsWith('sensor.')) return;
              // TEMPERATUR FILTER
              if (stateObj.attributes.device_class === 'temperature' && selectedTemp && entityId !== selectedTemp) {
                  excludeList.push(entityId);
              }
              
              // LUFTFEUCHTIGKEIT FILTER (Analog dazu)
              if (stateObj.attributes.device_class === 'humidity' && selectedHum && entityId !== selectedHum) {
                  excludeList.push(entityId);
              }
              
              // VOC FILTER
              if (stateObj.attributes.device_class === 'volatile_organic_compounds_parts' && selectedVoc && entityId !== selectedVoc) {
                  excludeList.push(entityId);
              }
            });
        }
    }

    const uniqueExcludeList = [...new Set(excludeList)];

    // Basis-Konfiguration
    const cardConfig = {
      type: "area",
      area: area.area_id,
      display_type: "compact",
      alert_classes: [ "motion", "moisture", "occupancy" ],
      features: [{ type: "area-controls" }],
      features_position: "inline",
      navigation_path: area.area_id,
      vertical: false,
      sensor_classes: ["temperature", "humidity", "volatile_organic_compounds_parts"]
    };

    if (hasManualSettings) {
      if (uniqueExcludeList.length > 0) {
          cardConfig.exclude_entities = uniqueExcludeList;
      }

    }

    return cardConfig;
  };

  
  if (!groupByFloors || !hass) {
    return {
      type: "grid",
      cards: [
        { type: "heading", heading_style: "title", heading: "Bereiche" },
        ...visibleAreas.map((area) => createAreaCard(area))
      ]
    };
  }

  const areasByFloor = new Map();
  const areasWithoutFloor = [];

  visibleAreas.forEach(area => {
    if (area.floor_id) {
      if (!areasByFloor.has(area.floor_id)) areasByFloor.set(area.floor_id, []);
      areasByFloor.get(area.floor_id).push(area);
    } else {
      areasWithoutFloor.push(area);
    }
  });

  const sections = [];
  const sortedFloors = Array.from(areasByFloor.keys()).sort((a, b) => {
    const nameA = hass.floors?.[a]?.name || a;
    const nameB = hass.floors?.[b]?.name || b;
    return nameA.localeCompare(nameB);
  });

  sortedFloors.forEach(floorId => {
    const areas = areasByFloor.get(floorId);
    const floor = hass.floors?.[floorId];
    sections.push({
      type: "grid",
      cards: [
        { type: "heading", heading_style: "title", heading: floor?.name || floorId, icon: floor?.icon || "mdi:floor-plan" },
        ...areas.map((area) => createAreaCard(area))
      ]
    });
  });

  if (areasWithoutFloor.length > 0) {
    sections.push({
      type: "grid",
      cards: [
        { type: "heading", heading_style: "title", heading: "Weitere Bereiche", icon: "mdi:home-outline" },
        ...areasWithoutFloor.map((area) => createAreaCard(area))
      ]
    });
  }

  return sections;
}


/**
 * Erstellt die Wetter & Energie-Section(s)
 * @param {string} weatherEntity - Weather Entity ID
 * @param {boolean} showWeather - Ob Wetter-Karte angezeigt werden soll
 * @param {boolean} showEnergy - Ob Energie-Dashboard angezeigt werden soll
 * @param {boolean} groupByFloors - Ob nach Etagen gruppiert wird
 * @returns {Array|Object|null} Section(s) oder null wenn keine Karten angezeigt werden
 */
export function createWeatherEnergySection(weatherEntity, showWeather, showEnergy, groupByFloors = false) {
  // Wenn Etagen-Gruppierung aktiv: Separate Sections zurückgeben
  if (groupByFloors) {
    const sections = [];
    
    // Weather Section (wenn vorhanden UND aktiviert)
    if (weatherEntity && showWeather) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "Wetter",
            heading_style: "title",
            icon: "mdi:weather-partly-cloudy"
          },
          {
            type: "weather-forecast",
            entity: weatherEntity,
            forecast_type: "daily"
          }
        ]
      });
    }
    
    // Energie Section (wenn aktiviert)
    if (showEnergy) {
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: "Energie",
            heading_style: "title",
            icon: "mdi:lightning-bolt"
          },
          {
            type: "energy-distribution",
            link_dashboard: true
          }
        ]
      });
    }
    
    // Gib leeres Array zurück wenn keine Sections vorhanden
    return sections;
  }
  
  // Standard: Alles in einer Section (wie bisher)
  const cards = [];
  
  // Füge Weather Forecast hinzu, wenn eine Weather-Entität gefunden wurde UND aktiviert
  if (weatherEntity && showWeather) {
    cards.push({
      type: "heading",
      heading: "Wetter",
      heading_style: "title",
      icon: "mdi:weather-partly-cloudy"
    });
    cards.push({
      type: "weather-forecast",
      entity: weatherEntity,
      forecast_type: "daily"
    });
  }
  
  // Energie-Dashboard (nur wenn aktiviert)
  if (showEnergy) {
    cards.push({
      type: "heading",
      heading: "Energie",
      heading_style: "title",
      icon: "mdi:lightning-bolt"
    });
    cards.push({
      type: "energy-distribution",
      link_dashboard: true
    });
  }
  
  // Gib null zurück wenn keine Karten vorhanden (verhindert leere Section)
  if (cards.length === 0) {
    return null;
  }
  
  return {
    type: "grid",
    cards: cards
  };
}