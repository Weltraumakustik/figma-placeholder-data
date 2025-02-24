function notify(message) {
  figma.ui.postMessage({ type: 'notify', message });
}

function replaceText(node, text) {
  if (node.type === 'TEXT') {
    figma.loadFontAsync(node.fontName).then(() => {
      node.characters = text;
    }).catch(err => {
      notify(`Fehler beim Laden der Schriftart für ${node.name}: ${err}`);
    });
  }
}

function replaceImage(node, base64Png) {
  console.log('replaceImage für:', node.name, 'base64Png:', base64Png ? base64Png.substring(0, 50) + '...' : 'undefined');
  if (node.type !== 'RECTANGLE' && node.type !== 'FRAME' && node.type !== 'GROUP') {
    notify(`Ungültiger Layer-Typ für Bild: ${node.type} (${node.name})`);
    return;
  }
  if (!base64Png || typeof base64Png !== 'string' || !base64Png.startsWith('data:image/png;base64,')) {
    notify(`Ungültiges Bildformat für ${node.name}: ${base64Png}`);
    return;
  }
  if (typeof figma.createImage !== 'function') {
    notify('figma.createImage ist keine Funktion! Plugin-Umgebung prüfen.');
    console.error('figma:', figma, 'createImage:', figma.createImage);
    return;
  }
  try {
    const imageBytes = Uint8Array.from(atob(base64Png.split(',')[1]), c => c.charCodeAt(0));
    const image = figma.createImage(imageBytes);
    if (!image || !image.hash) {
      throw new Error('Kein gültiges Bildobjekt');
    }
    node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
    console.log(`Bild erfolgreich eingefügt in ${node.name}`);
  } catch (err) {
    notify(`Fehler beim Bild für ${node.name}: ${err.message}`);
    console.error('Fehler in replaceImage:', err);
  }
}

function processNode(node, jsonData, index = null) {
  if (!jsonData || jsonData.length === 0) return false;
  const data = index !== null && index >= 0 && index < jsonData.length ? jsonData[index] : null;
  if (node.name.includes('.')) {
    const [_, property] = node.name.split('.');
    if (data) {
      if (property === 'name' && data.name) {
        replaceText(node, data.name);
      } else if (property === 'logo' && data.logoPng) {
        replaceImage(node, data.logoPng);
      }
    }
    return true;
  }
  if (node.type === 'GROUP' || node.type === 'FRAME') {
    const indexFromName = jsonData.findIndex(item => item.name === node.name);
    if (indexFromName !== -1) {
      const groupData = jsonData[indexFromName];
      node.children.forEach(child => {
        const [_, property] = child.name.split('.');
        if (property === 'name' && groupData.name) {
          replaceText(child, groupData.name);
        } else if (property === 'logo' && groupData.logoPng) {
          replaceImage(child, groupData.logoPng);
        }
      });
      return true;
    }
  }
  if (data) {
    if (node.type === 'TEXT' && data.name) {
      replaceText(node, data.name);
    } else if ((node.type === 'RECTANGLE' || node.type === 'FRAME' || node.type === 'GROUP') && data.logoPng) {
      replaceImage(node, data.logoPng);
    }
  }
  return false;
}

let jsonData = [];

figma.showUI(__html__, { width: 400, height: 500 });

figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  figma.ui.postMessage({ type: 'selection-changed', multiple: selection.length > 1 });
});

figma.ui.onmessage = (msg) => {
  const selection = figma.currentPage.selection;
  if (msg.type === 'json-loaded') {
    jsonData = msg.data || [];
    console.log('jsonData aktualisiert:', jsonData);
  }
  if (msg.type === 'replace-single') {
    if (selection.length !== 1) {
      notify('Bitte wähle genau ein Element aus!');
      return;
    }
    if (!jsonData || jsonData.length === 0) {
      notify('Daten wurden noch nicht geladen!');
      return;
    }
    if (msg.index < 0 || msg.index >= jsonData.length) {
      notify('Ungültiger Index!');
      return;
    }
    processNode(selection[0], jsonData, msg.index);
    notify('Element wurde ersetzt!');
  }
  if (msg.type === 'replace-random') {
    if (selection.length === 0) {
      notify('Bitte wähle mindestens ein Element aus!');
      return;
    }
    if (!jsonData || jsonData.length === 0) {
      notify('Daten wurden noch nicht geladen!');
      return;
    }
    selection.forEach(node => {
      if (!processNode(node, jsonData)) {
        const randomIndex = Math.floor(Math.random() * jsonData.length);
        processNode(node, jsonData, randomIndex);
      }
    });
    notify('Elemente wurden ersetzt!');
  }
};