figma.showUI(__html__, { width: 540, height: 600 });

let customerData = [];

async function loadCustomerData() {
  try {
    const response = await fetch("https://github.com/Weltraumakustik/figma-placeholder-data/data/json/customers.json");
    customerData = await response.json();
    console.log("Customer Data:", customerData);
    figma.ui.postMessage({ type: "showData", data: customerData });
    figma.notify("Customer Data geladen!");
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    figma.notify("Fehler beim Laden der Daten. Siehe Konsole.");
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "reload-data") {
    await loadCustomerData();
  } else if (msg.type === "replace-with-brand") {
    const brandId = msg.brandId;
    singleBrandReplace(brandId);
  } else if (msg.type === "replace-multi") {
    const brandIds = msg.brandIds || [];
    multiBrandReplace(brandIds);
  }
};

async function singleBrandReplace(brandId) {
  const brand = findBrandById(brandId);
  if (!brand) {
    figma.notify("Brand '" + brandId + "' nicht gefunden!");
    return;
  }
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify("Bitte eine Gruppe/Frame auswählen!");
    return;
  }
  for (const node of selection) {
    const allChildren = getAllChildNodes(node);
    for (const child of allChildren) {
      if (child.name === "customer.name" && child.type === "TEXT") {
        await loadAllFonts(child);
        child.characters = brand.name || brand.id;
      }
      if (child.name === "customer.logo" && child.type === "RECTANGLE") {
        await setLogoFill(child, brand.logo);
      }
    }
  }
  figma.notify("Single-Brand-Replacement abgeschlossen!");
}

async function multiBrandReplace(brandIds) {
  console.log("Multi replace, brandIds:", brandIds);
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify("Bitte Gruppen/Frames auswählen!");
    return;
  }
  let brandIndex = 0;
  for (const node of selection) {
    let brand = null;
    const match = node.name.match(/customer\.([a-z0-9-]+)/i);
    if (match) {
      const groupKey = match[1].toLowerCase();
      brand = findBrandById(groupKey);
      if (!brand) {
        brand = getRandomBrand();
      }
    } else {
      if (brandIndex < brandIds.length) {
        brand = findBrandById(brandIds[brandIndex]);
        brandIndex++;
        if (!brand) {
          brand = getRandomBrand();
        }
      } else {
        brand = getRandomBrand();
      }
    }
    if (!brand) {
      console.log("Keine Brand gefunden, skippe");
      continue;
    }
    const allChildren = getAllChildNodes(node);
    for (const child of allChildren) {
      if (child.name === "customer.name" && child.type === "TEXT") {
        await loadAllFonts(child);
        child.characters = brand.name || brand.id;
      }
      if (child.name === "customer.logo" && child.type === "RECTANGLE") {
        await setLogoFill(child, brand.logo);
      }
    }
  }
  figma.notify("Multi-Replacement abgeschlossen!");
}

loadCustomerData();

function findBrandById(brandId) {
  return customerData.find(b => b.id && b.id.toLowerCase() === brandId.toLowerCase());
}

function getRandomBrand() {
  if (!customerData.length) return null;
  const idx = Math.floor(Math.random() * customerData.length);
  return customerData[idx];
}

function getAllChildNodes(parent) {
  const result = [];
  if ("children" in parent) {
    for (const child of parent.children) {
      result.push(child);
      if ("children" in child) {
        result.push(...getAllChildNodes(child));
      }
    }
  }
  return result;
}

async function setLogoFill(rectNode, logoUrl) {
  try {
    const logoResponse = await fetch(logoUrl);
    const logoBuffer = await logoResponse.arrayBuffer();
    const imageBytes = new Uint8Array(logoBuffer);
    const image = figma.createImage(imageBytes);
    rectNode.fills = [{
      type: "IMAGE",
      scaleMode: "FIT",
      imageHash: image.hash
    }];
  } catch (err) {
    console.error("Fehler beim Laden des Logos:", err);
  }
}

async function loadAllFonts(textNode) {
  const len = textNode.characters.length;
  const fontNames = textNode.getRangeAllFontNames(0, len);
  for (const fontName of fontNames) {
    await figma.loadFontAsync(fontName);
  }
}