App link:
https://cogent-treat-488817-i9.projects.earthengine.app/view/flood-analyzer-sar


**ABOUT THE FLOOD ANALYZER APP**

This application is a satellite monitoring tool that enables the automatic detection and visualization of flooded areas on the ground surface. By utilizing radar data from Sentinel-1 satellites, the system can collect information regardless of cloud cover or time of day (day or night).

Its operation is based on comparing two different time periods for the same geographical location. The algorithm analyzes a reference image showing the area under normal, dry "Before" conditions and compares it with an image captured immediately after an intense flooding event ("After"). Through this differential analysis, the tool isolates changes caused exclusively by the presence of water, excluding permanent landscape elements like lakes or rivers.

The user can define any area and date of interest to receive an automatic estimation of the flooded area in stremmata (1 stremma = 0.1 hectares). By default, the application is configured to display the impact of storm Daniel on the Thessalian plain in 2023.


**FLOOD ANALYZER TECHNICAL METHODOLOGY**

**SAR Radar Physics**
The Flood Analyzer algorithm uses data from the European Space Agency's Sentinel-1 satellite. Synthetic Aperture Radar (SAR) emits microwaves that penetrate clouds and darkness. Dry surfaces cause signal scattering back to the satellite. Conversely, standing water causes specular reflection, which deflects the signal away from the sensor. As a result, flooded areas are recorded as dark pixels with low backscatter values in decibels.

**Image Selection Based on Temporal Proximity**
The method relies on isolating the most chronologically relevant captures within the date range specified by the user. For the reference image before the flood, the latest available capture in the series is automatically selected to reflect the ground conditions as close to the start of the event as possible. For the flood image, the first available capture after the start date is selected to record the extent of the water before it recedes or is absorbed.

**Data Processing and Filtering**
The processing includes applying a Focal Mean filter with a 15-meter radius to reduce the digital speckle noise characteristic of radar images. This is followed by subtracting the reference image from the flood image to detect changes in signal intensity. Concurrently, an SRTM Digital Elevation Model is used to mask out areas with a slope greater than 5 degrees. This process eliminates errors arising from radar shadows in mountainous areas, which visually resemble water surfaces.

**Detection Criteria and Thresholds**
Classifying a pixel as flooded requires satisfying two criteria simultaneously. The decrease in signal intensity between the two captures must exceed 4.5 dB. Additionally, the absolute value of the signal in the post-event image must be less than -18 dB. These thresholds scientifically define the presence of a free water surface in environments with low vegetation or bare soil.

**Area Calculation**
The final area is derived by multiplying the number of detected pixels by the area covered by each pixel on the ground. The result is given in stremmata, providing a quantitative estimate of the flooded area. The accuracy of the method is linked to the satellite's revisit frequency, which for the region of Greece ranges between 6 and 12 days.