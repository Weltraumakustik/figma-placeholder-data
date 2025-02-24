function notify(message) {
  figma.ui.postMessage({ type: 'notify', message });
}

function replaceText(node, text) {
  if (node.type === 'TEXT') {
    figma.loadFontAsync(node.fontName)
      .then(() => { node.characters = text; })
      .catch(err => { notify(`Fehler beim Laden der Schriftart für ${node.name}: ${err}`); });
  }
}

async function dataURLtoUint8Array(dataURL) {
  const res = await fetch(dataURL);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

async function replaceImage(node, base64Png) {
  if (node.type === 'INSTANCE') {
    node = node.detachInstance();
  }
  if (node.type !== 'RECTANGLE' && node.type !== 'FRAME' && node.type !== 'GROUP') {
    throw new Error(`Ungültiger Layer-Typ für Bild: ${node.type} (${node.name})`);
  }
  if (!base64Png || typeof base64Png !== 'string' || !base64Png.startsWith('data:image/png;base64,')) {
    throw new Error(`Ungültiges Bildformat für ${node.name}`);
  }
  if (typeof figma.createImage !== 'function') {
    throw new Error('figma.createImage ist keine Funktion! Plugin-Umgebung prüfen.');
  }
  const imageBytes = await dataURLtoUint8Array(base64Png);
  const image = figma.createImage(imageBytes);
  if (!image || !image.hash) {
    throw new Error('Kein gültiges Bildobjekt');
  }
  node.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
  console.log(`Bild erfolgreich eingefügt in ${node.name}`);
}

async function processNode(node, jsonData, index = null) {
  if (!jsonData || jsonData.length === 0) return false;
  const data = index !== null && index >= 0 && index < jsonData.length ? jsonData[index] : null;
  if (node.name.includes('.')) {
    const [_, property] = node.name.split('.');
    if (data) {
      if (property === 'name' && data.name) {
        replaceText(node, data.name);
      } else if (property === 'logo' && data.logoPng) {
        try {
          await replaceImage(node, data.logoPng);
        } catch (e) {
          notify(`Fehler beim Bild für ${node.name}: ${e.message}. Ersetze mit Text.`);
          replaceText(node, data.name);
        }
      }
    }
    return true;
  }
  if (node.type === 'GROUP' || node.type === 'FRAME') {
    const indexFromName = jsonData.findIndex(item => item.name === node.name);
    if (indexFromName !== -1) {
      const groupData = jsonData[indexFromName];
      for (const child of node.children) {
        const parts = child.name.split('.');
        if (parts.length > 1) {
          const property = parts[1];
          if (property === 'name' && groupData.name) {
            replaceText(child, groupData.name);
          } else if (property === 'logo' && groupData.logoPng) {
            try {
              await replaceImage(child, groupData.logoPng);
            } catch (e) {
              notify(`Fehler beim Bild für ${child.name}: ${e.message}. Ersetze mit Text.`);
              replaceText(child, groupData.name);
            }
          }
        }
      }
      return true;
    }
  }
  if (data) {
    if (node.type === 'TEXT' && data.name) {
      replaceText(node, data.name);
    } else if ((node.type === 'RECTANGLE' || node.type === 'FRAME' || node.type === 'GROUP') && data.logoPng) {
      try {
        await replaceImage(node, data.logoPng);
      } catch (e) {
        notify(`Fehler beim Bild für ${node.name}: ${e.message}. Ersetze mit Text.`);
        replaceText(node, data.name);
      }
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

figma.ui.onmessage = async (msg) => {
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
    await processNode(selection[0], jsonData, msg.index);
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
    for (const node of selection) {
      if (!(await processNode(node, jsonData))) {
        const randomIndex = Math.floor(Math.random() * jsonData.length);
        await processNode(node, jsonData, randomIndex);
      }
    }
    notify('Elemente wurden ersetzt!');
  }
};