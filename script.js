// --- 1. DEFAULT AREA (KARLA) ---
var defaultCoords = [
  [22.49049206440212, 39.43721741265812],
  [22.791242796823994, 39.43721741265812],
  [22.791242796823994, 39.67861918503206],
  [22.49049206440212, 39.67861918503206],
  [22.49049206440212, 39.43721741265812]
];
var defaultGeometry = ee.Geometry.Polygon(defaultCoords);

Map.setOptions('terrain');
Map.centerObject(defaultGeometry, 11);

var drawingTools = Map.drawingTools();
drawingTools.layers().reset(); 
drawingTools.addLayer([defaultGeometry], 'Default_Area', 'red', false);

// --- 2. GRAPHICAL USER INTERFACE (UI PANEL) ---
var panel = ui.Panel({ style: {width: '360px', padding: '15px'} });
ui.root.insert(0, panel);

panel.add(ui.Label('Flood Analysis (SAR)', {fontWeight: 'bold', fontSize: '20px', color: 'darkblue'}));

var instructionsPanel = ui.Panel({
  style: {shown: false, backgroundColor: '#f9f9f9', padding: '10px', border: '1px solid #ddd', margin: '5px 0'}
});

instructionsPanel.add(ui.Label('How to run your own analysis:', {fontWeight: 'bold', color: 'darkblue', fontSize: '13px'}));
instructionsPanel.add(ui.Label('1. CLEAR: Click "Clear Map" to erase the default area.', {fontSize: '11px'}));
instructionsPanel.add(ui.Label('2. DRAW: Use the polygon tool (top left) to define the new area.', {fontSize: '11px'}));
instructionsPanel.add(ui.Label('3. SETTINGS: Enter the Year and the "Before" and "After" date ranges (DD-MM).', {fontSize: '11px'}));
instructionsPanel.add(ui.Label('4. ORBIT: If you don\'t see any data, change the pass to ASCENDING.', {fontSize: '11px'}));

var toggleButton = ui.Button({
  label: '▶ Usage Instructions',
  onClick: function() {
    var isShown = instructionsPanel.style().get('shown');
    instructionsPanel.style().set('shown', !isShown);
    toggleButton.setLabel(isShown ? '▶ Usage Instructions' : '▼ Close Instructions');
  },
  style: {stretch: 'horizontal'}
});
panel.add(toggleButton);
panel.add(instructionsPanel);

panel.add(ui.Label('Year:', {fontWeight: 'bold', margin: '10px 0 0 0'})); 
var targetYearBox = ui.Textbox({value: '2023'});
panel.add(targetYearBox);

panel.add(ui.Label('Before Dates (DD-MM):', {fontWeight: 'bold'}));
var beforePanel = ui.Panel([ui.Textbox({value: '01-09', style: {width: '80px'}}), ui.Textbox({value: '03-09', style: {width: '80px'}})], ui.Panel.Layout.Flow('horizontal'));
panel.add(beforePanel);

panel.add(ui.Label('After Dates (DD-MM):', {fontWeight: 'bold'}));
var afterPanel = ui.Panel([ui.Textbox({value: '07-09', style: {width: '80px'}}), ui.Textbox({value: '15-09', style: {width: '80px'}})], ui.Panel.Layout.Flow('horizontal'));
panel.add(afterPanel);

panel.add(ui.Label('Satellite Pass:', {fontWeight: 'bold'}));
var passSelect = ui.Select({ items: ['DESCENDING', 'ASCENDING'], value: 'DESCENDING' });
panel.add(passSelect);

var runButton = ui.Button({ label: 'Run Analysis', style: {stretch: 'horizontal', color: 'darkblue', fontWeight: 'bold'} });
var clearButton = ui.Button({ label: 'Clear Map', style: {stretch: 'horizontal'} });
panel.add(runButton);
panel.add(clearButton);

var resultsPanel = ui.Panel({style: {margin: '15px 0 0 0', padding: '10px', backgroundColor: '#eeeeee'}});
panel.add(resultsPanel);

// --- 3. LEGEND FUNCTION ---
var addLegend = function() {
  var legend = ui.Panel({
    style: {position: 'bottom-right', padding: '8px 15px'}
  });
  var makeRow = function(color, name) {
    var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', margin: '0'}});
    var description = ui.Label({value: name, style: {margin: '0 0 0 6px', fontSize: '12px'}});
    return ui.Panel({widgets: [colorBox, description], layout: ui.Panel.Layout.Flow('horizontal')});
  };
  legend.add(ui.Label('Legend', {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0'}));
  legend.add(makeRow('#0000CC', 'Potential Flood'));
  legend.add(makeRow('#0000FF', 'Signal Decrease (Water)'));
  legend.add(makeRow('#FF0000', 'Signal Increase (Land)'));
  Map.add(legend);
};

// --- 4. ANALYSIS FUNCTION ---
var runAnalysis = function() {
  var layers = drawingTools.layers();
  if (layers.length() === 0) {
    resultsPanel.clear();
    resultsPanel.add(ui.Label('⚠️ Error: Please draw a polygon!', {color: 'red', fontWeight: 'bold', margin: '4px 0 4px 8px'}));
    return; 
  }
  var aoi = layers.get(0).getEeObject();
  
  Map.centerObject(aoi, 11);
  Map.clear(); 
  Map.setOptions('terrain');
  addLegend();
  resultsPanel.clear();
  
  var outline = ee.Image().paint({
    featureCollection: ee.FeatureCollection([aoi]),
    color: 1,
    width: 2
  });
  Map.addLayer(outline, {palette: 'red'}, 'Study Area');
  
  resultsPanel.add(ui.Label('⏳ Calculating...', {color: 'gray', margin: '4px 0 4px 8px'}));

  var targetYear = targetYearBox.getValue();
  
  var convertDate = function(val) {
    var parts = val.split('-');
    return '-' + parts[1] + '-' + parts[0];
  };

  var bStart = convertDate(beforePanel.widgets().get(0).getValue());
  var bEnd = convertDate(beforePanel.widgets().get(1).getValue());
  var aStart = convertDate(afterPanel.widgets().get(0).getValue());
  var aEnd = convertDate(afterPanel.widgets().get(1).getValue());
  
  var passDirection = passSelect.getValue();

  var imgVV = ee.ImageCollection('COPERNICUS/S1_GRD')
          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
          .filterBounds(aoi)
          .filter(ee.Filter.eq('orbitProperties_pass', passDirection))
          .select('VV');

  var dem = ee.Image("USGS/SRTMGL1_003").clip(aoi);
  var flatMask = ee.Algorithms.Terrain(dem).select('slope').lt(5);

  var yearStr = targetYear.toString();
  var aColRaw = imgVV.filterDate(yearStr + aStart, yearStr + aEnd);
  
  // CHECK FOR 'AFTER' IMAGE AVAILABILITY
  aColRaw.size().evaluate(function(aSize) {
    if (aSize === 0) {
      resultsPanel.clear();
      resultsPanel.add(ui.Label('⚠️ Error: No "After" image found in the given date range.', {fontWeight: 'bold', color: 'red', margin: '4px 0 4px 8px'}));
      resultsPanel.add(ui.Label('Try a wider range or change the Satellite Pass.', {fontSize: '11px', color: 'gray', margin: '8px 0 0 8px'}));
      return;
    }

    // FIX: Ensure common relative orbit
    var floodImage = aColRaw.sort('system:time_start').first();
    var relativeOrbit = floodImage.get('relativeOrbitNumber_start');
    
    var aCol = aColRaw.filter(ee.Filter.eq('relativeOrbitNumber_start', relativeOrbit));
    var bCol = imgVV.filterDate(yearStr + bStart, yearStr + bEnd)
                    .filter(ee.Filter.eq('relativeOrbitNumber_start', relativeOrbit));

    bCol.size().evaluate(function(bSize) {
      if (bSize === 0) {
        resultsPanel.clear();
        resultsPanel.add(ui.Label('⚠️ Error: No matching "Before" image found in the same orbit.', {fontWeight: 'bold', color: 'red', margin: '4px 0 4px 8px'}));
        resultsPanel.add(ui.Label('Widen the "Before" date range.', {fontSize: '11px', color: 'gray', margin: '8px 0 0 8px'}));
        return;
      }

      // CONTINUE ANALYSIS
      var before = bCol.sort('system:time_start', false).first().focal_mean(15, 'circle', 'meters').clip(aoi);
      var after = aCol.sort('system:time_start').first().focal_mean(15, 'circle', 'meters').clip(aoi);
      
      var diff = after.subtract(before);
      Map.addLayer(diff.updateMask(flatMask), {min: -10, max: 10, palette: ['0000FF', 'FFFFFF', 'FF0000']}, 'Difference ' + targetYear);
      
      var floodMask = diff.lt(-4.5).and(after.lt(-18)).selfMask().updateMask(flatMask);
      Map.addLayer(floodMask, {palette: ['0000CC']}, 'Flood Mask ' + targetYear);

      var beforeDate = bCol.sort('system:time_start', false).first().date().format('dd-MM-YYYY');
      var afterDate = aCol.sort('system:time_start').first().date().format('dd-MM-YYYY');
      
      var area = floodMask.multiply(ee.Image.pixelArea()).reduceRegion({
        reducer: ee.Reducer.sum(), 
        geometry: aoi, 
        scale: 50, 
        maxPixels: 1e13
      });
      
      var stats = ee.Dictionary({
        'areaVal': area.get('VV'),
        'dateBefore': beforeDate,
        'dateAfter': afterDate
      });
      
      stats.evaluate(function(res) {
        resultsPanel.clear();
        Map.centerObject(aoi, 11);
        
        var val = res.areaVal ? Math.round(res.areaVal / 1000) : 0;
        
        resultsPanel.add(ui.Label('Results for ' + targetYear + ':', {fontWeight: 'bold', fontSize: '14px', margin: '4px 0 4px 8px'}));
        resultsPanel.add(ui.Label('Water Area: ' + val + ' Stremmata', {color: 'darkred', fontSize: '16px', fontWeight: 'bold', margin: '4px 0 8px 8px'}));
        
        resultsPanel.add(ui.Label('S1 Image Capture Dates:', {fontSize: '10px', color: 'gray', margin: '8px 0 0 8px'}));
        resultsPanel.add(ui.Label('Before: ' + res.dateBefore + ' | After: ' + res.dateAfter, {fontSize: '10px', color: '#555', margin: '2px 0 8px 8px'}));
      });
    });
  });
};

runButton.onClick(runAnalysis);
clearButton.onClick(function() { 
  Map.clear(); 
  Map.setOptions('terrain');
  drawingTools.layers().reset(); 
  resultsPanel.clear(); 
});

runAnalysis();