
"use strict";

// =====================================
// FLORA - MAIN JAVASCRIPT
// =====================================


const charts = {
    production: null,
    crops: null,
    regional: null,
    statisticsTrend: null,
    statisticsCrops: null,
    district: null,
    prediction: null ,
    climateRainfall: null,
climateTemperature: null,
climateRegion: null,
district: null
};

// =====================================
// HELPER FUNCTIONS
// =====================================

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-US", {
        maximumFractionDigits: 2
    });
}


function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


async function fetchJSON(url) {
    const response = await fetch(url);

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "Request failed");
    }

    return result;
}


function showChartError(canvasId, message) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const container = canvas.parentElement;

    if (container) {
        container.innerHTML = "";

        const error = document.createElement("p");
        error.textContent = message;
        error.style.color = "#b45353";
        error.style.padding = "30px";
        error.style.textAlign = "center";

        container.appendChild(error);
    }
}


function showTableMessage(message) {
    const body = document.getElementById("regionalTableBody");

    if (!body) return;

    body.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.textContent = message;

    row.appendChild(cell);
    body.appendChild(row);
}


function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return null;

    if (typeof Chart === "undefined") {
        showChartError(canvasId, "Chart library could not load. Check your internet connection.");
        return null;
    }

    return new Chart(canvas, config);
}


// =====================================
// DASHBOARD SUMMARY
// =====================================

async function loadSummary() {
    try {
        const result = await fetchJSON("/api/dashboard/summary");

        const data = result.data;

        setText("totalProduction", formatNumber(data.total_production));
        setText("totalArea", formatNumber(data.total_area));
        setText("totalCrops", formatNumber(data.total_crops));
        setText("totalDistricts", formatNumber(data.total_districts));

        console.log("Dashboard summary loaded.");

    } catch (error) {
        console.error("Summary error:", error);

        [
            "totalProduction",
            "totalArea",
            "totalCrops",
            "totalDistricts"
        ].forEach(id => setText(id, "Unavailable"));
    }
}


// =====================================
// LOAD FILTER OPTIONS
// =====================================

async function loadFilters() {
    const result = await fetchJSON("/api/dashboard/filters");

    const cropFilter = document.getElementById("cropFilter");
    const yearFilter = document.getElementById("yearFilter");

    if (cropFilter) {
        cropFilter.replaceChildren(
            new Option("All Crops", "")
        );

        result.crops.forEach(crop => {
            cropFilter.add(
                new Option(crop.crop_name, crop.crop_id)
            );
        });
    }

    if (yearFilter) {
        yearFilter.replaceChildren(
            new Option("All Years", "")
        );

        result.years.forEach(item => {
            yearFilter.add(
                new Option(item.production_year, item.production_year)
            );
        });
    }
}


// =====================================
// PRODUCTION TREND CHART
// =====================================

async function loadProductionChart() {
    const canvas = document.getElementById("productionChart");

    if (!canvas) return;

    try {
        const filter = document.getElementById("cropFilter");
        const cropId = filter ? filter.value : "";

        const url = cropId
            ? `/api/dashboard/filtered-trend?crop_id=${encodeURIComponent(cropId)}`
            : "/api/dashboard/filtered-trend";

        const result = await fetchJSON(url);

        if (charts.production) {
            charts.production.destroy();
            charts.production = null;
        }

        if (!result.data.length) {
            showChartError("productionChart", "No production records found.");
            return;
        }

        charts.production = createChart("productionChart", {
            type: "line",

            data: {
                labels: result.data.map(item => item.production_year),

                datasets: [{
                    label: "Production (Tonnes)",

                    data: result.data.map(
                        item => Number(item.total_production || 0)
                    ),

                    borderColor: "#23834e",
                    backgroundColor: "rgba(35,131,78,0.12)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointRadius: 4
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: true
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error("Production chart error:", error);
        showChartError("productionChart", "Unable to load production trends.");
    }
}


// =====================================
// CROP COMPARISON CHART
// =====================================

async function loadCropChart() {
    const canvas = document.getElementById("cropChart");

    if (!canvas) return;

    try {
        const filter = document.getElementById("yearFilter");
        const year = filter ? filter.value : "";

        const url = year
            ? `/api/dashboard/filtered-crops?year=${encodeURIComponent(year)}`
            : "/api/dashboard/filtered-crops";

        const result = await fetchJSON(url);

        if (charts.crops) {
            charts.crops.destroy();
            charts.crops = null;
        }

        if (!result.data.length) {
            showChartError("cropChart", "No crop production records found.");
            return;
        }

        charts.crops = createChart("cropChart", {
            type: "bar",

            data: {
                labels: result.data.map(item => item.crop_name),

                datasets: [{
                    label: "Production (Tonnes)",

                    data: result.data.map(
                        item => Number(item.total_production || 0)
                    ),

                    backgroundColor: [
                        "#256b45",
                        "#398b5d",
                        "#57a879",
                        "#78bd92",
                        "#a0d0ae",
                        "#4b8261",
                        "#89a994",
                        "#315c43",
                        "#b1c9b6"
                    ],

                    borderRadius: 6
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        console.error("Crop chart error:", error);
        showChartError("cropChart", "Unable to load crop comparison.");
    }
}


// =====================================
// REGIONAL ANALYSIS
// =====================================

async function loadRegionalAnalysis() {
    try {
        const result = await fetchJSON("/api/regional/summary");

        const regions = result.data;

        if (!regions.length) {
            throw new Error("No regional records found.");
        }

        // Calculate regional totals

        const totalProduction = regions.reduce(
            (sum, region) =>
                sum + Number(region.total_production || 0),
            0
        );

        const totalArea = regions.reduce(
            (sum, region) =>
                sum + Number(region.total_area || 0),
            0
        );

        const totalDistricts = regions.reduce(
            (sum, region) =>
                sum + Number(region.total_districts || 0),
            0
        );

        // Update summary cards

        setText("regionalProduction", formatNumber(totalProduction));
        setText("regionalArea", formatNumber(totalArea));
        setText("regionalCount", regions.length);
        setText("regionalDistricts", totalDistricts);

        // Update regional table

        const tableBody = document.getElementById("regionalTableBody");

        if (tableBody) {
            tableBody.replaceChildren();

            regions.forEach(region => {
                const row = document.createElement("tr");

                const values = [
                    region.region_name,
                    formatNumber(region.total_districts),
                    formatNumber(region.total_crops),
                    formatNumber(region.total_production),
                    formatNumber(region.total_area),
                    formatNumber(region.weighted_yield)
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                tableBody.appendChild(row);
            });
        }

        // Update regional chart

        const canvas = document.getElementById("regionalChart");

        if (canvas) {
            if (charts.regional) {
                charts.regional.destroy();
                charts.regional = null;
            }

            charts.regional = createChart("regionalChart", {
                type: "bar",

                data: {
                    labels: regions.map(
                        region => region.region_name
                    ),

                    datasets: [{
                        label: "Production (Tonnes)",

                        data: regions.map(
                            region => Number(region.total_production || 0)
                        ),

                        backgroundColor: [
                            "#398b5d",
                            "#57a879",
                            "#78bd92"
                        ],

                        borderRadius: 8
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        y: {
                            beginAtZero: true,

                            title: {
                                display: true,
                                text: "Production (Tonnes)"
                            }
                        }
                    }
                }
            });
        }

        console.log("Regional analysis loaded.");

    } catch (error) {
        console.error("Regional analysis error:", error);

        setText("regionalProduction", "Unavailable");
        setText("regionalArea", "Unavailable");
        setText("regionalCount", "Unavailable");
        setText("regionalDistricts", "Unavailable");

        showTableMessage("Unable to load regional data.");
        showChartError("regionalChart", "Unable to load regional chart.");
    }
}

/* =====================================
   DISTRICT ANALYSIS
===================================== */

async function loadDistrictFilters() {
    const result = await fetchJSON("/api/dashboard/filters");

    const cropFilter = document.getElementById(
        "districtCropFilter"
    );

    const yearFilter = document.getElementById(
        "districtYearFilter"
    );

    if (cropFilter) {
        cropFilter.replaceChildren(
            new Option("All Crops", "")
        );

        result.crops.forEach(crop => {
            cropFilter.add(
                new Option(crop.crop_name, crop.crop_id)
            );
        });
    }

    if (yearFilter) {
        yearFilter.replaceChildren(
            new Option("All Years", "")
        );

        result.years.forEach(item => {
            yearFilter.add(
                new Option(
                    item.production_year,
                    item.production_year
                )
            );
        });
    }
}


async function loadDistrictAnalysis() {

    try {
        const crop = document.getElementById(
            "districtCropFilter"
        );

        const year = document.getElementById(
            "districtYearFilter"
        );

        const params = new URLSearchParams();

        if (crop && crop.value) {
            params.set("crop_id", crop.value);
        }

        if (year && year.value) {
            params.set("year", year.value);
        }

        const result = await fetchJSON(
            `/api/districts/analysis?${params.toString()}`
        );

        const districts = result.data || [];

        if (charts.district) {
            charts.district.destroy();
            charts.district = null;
        }

        const body = document.getElementById(
            "districtTableBody"
        );

        if (!districts.length) {
            setText("districtCount", "0");
            setText("districtProduction", "0");
            setText("districtArea", "0");
            setText("districtYield", "0");

            if (body) {
                body.replaceChildren();

                const row = document.createElement("tr");
                const cell = document.createElement("td");

                cell.colSpan = 7;
                cell.textContent = "No district records found.";

                row.appendChild(cell);
                body.appendChild(row);
            }

            showChartError(
                "districtChart",
                "No district production records found."
            );

            return;
        }

        // Calculate totals

        const totalProduction = districts.reduce(
            (sum, item) =>
                sum + Number(item.total_production || 0),
            0
        );

        const totalArea = districts.reduce(
            (sum, item) =>
                sum + Number(item.total_area || 0),
            0
        );

        const averageYield = totalArea > 0
            ? (totalProduction * 1000) / totalArea
            : 0;

        setText("districtCount", districts.length);
        setText(
            "districtProduction",
            formatNumber(totalProduction)
        );
        setText("districtArea", formatNumber(totalArea));
        setText("districtYield", formatNumber(averageYield));

        // Build district table

        if (body) {
            body.replaceChildren();

            districts.forEach((district, index) => {

                const row = document.createElement("tr");

                const values = [
                    index + 1,
                    district.district_name,
                    district.region_name,
                    formatNumber(district.total_crops),
                    formatNumber(district.total_production),
                    formatNumber(district.total_area),
                    formatNumber(district.weighted_yield)
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                body.appendChild(row);
            });
        }

        // Build district production chart

        const topDistricts = districts.slice(0, 15);

        charts.district = createChart("districtChart", {
            type: "bar",

            data: {
                labels: topDistricts.map(
                    item => item.district_name
                ),

                datasets: [{
                    label: "Production (Tonnes)",

                    data: topDistricts.map(
                        item => Number(item.total_production || 0)
                    ),

                    backgroundColor: "#398b5d",
                    borderRadius: 6
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Production (Tonnes)"
                        }
                    }
                }
            }
        });

        console.log("District analysis loaded.");

    } catch (error) {

        console.error("District analysis error:", error);

        setText("districtCount", "Unavailable");
        setText("districtProduction", "Unavailable");
        setText("districtArea", "Unavailable");
        setText("districtYield", "Unavailable");

        showTableMessage("Unable to load district records.");
        showChartError(
            "districtChart",
            "Unable to load district analysis."
        );
    }
}
// =====================================
// YIELD PREDICTION
// =====================================

async function loadPredictionFilters() {
    const result = await fetchJSON("/api/prediction/filters");

    const cropSelect = document.getElementById("predictionCrop");
    const regionSelect = document.getElementById("predictionRegion");

    cropSelect.replaceChildren(
        new Option("Select Crop", "")
    );

    result.crops.forEach(crop => {
        cropSelect.add(
            new Option(crop.crop_name, crop.crop_id)
        );
    });

    regionSelect.replaceChildren(
        new Option("All Regions", "")
    );

    result.regions.forEach(region => {
        regionSelect.add(
            new Option(region.region_name, region.region_id)
        );
    });
}


async function loadYieldPrediction() {
    const cropSelect = document.getElementById("predictionCrop");
    const regionSelect = document.getElementById("predictionRegion");

    const cropId = cropSelect.value;
    const regionId = regionSelect.value;

    if (!cropId) {
        setText("predictionMessage", "Please select a crop first.");
        return;
    }

    setText("predictionMessage", "Calculating prediction...");
    setText("predictedYield", "--");
    setText("predictedYear", "Next year");
    setText("latestYield", "--");
    setText("yieldChange", "--");
    setText("yieldTrend", "--");

    const params = new URLSearchParams({
        crop_id: cropId
    });

    if (regionId) {
        params.append("region_id", regionId);
    }

    try {
        const result = await fetchJSON(
            `/api/prediction/yield?${params.toString()}`
        );

        const history = result.data || [];
        const prediction = result.prediction;

        if (charts.prediction) {
            charts.prediction.destroy();
            charts.prediction = null;
        }

        if (!history.length) {
            setText("predictionMessage", "No valid historical records found.");
            return;
        }

        if (!prediction) {
            setText(
                "predictionMessage",
                result.message || "At least two years of records are required."
            );
            return;
        }

        setText(
            "predictedYield",
            formatNumber(prediction.yield)
        );

        setText(
            "predictedYear",
            `Year ${prediction.year} · Kg/hectare`
        );

        setText(
            "latestYield",
            formatNumber(prediction.latest_yield)
        );

        setText(
            "yieldChange",
            prediction.change_percent === null
                ? "Unavailable"
                : `${prediction.change_percent > 0 ? "+" : ""}${prediction.change_percent}%`
        );

        setText("yieldTrend", prediction.trend);

        setText(
            "predictionMessage",
            "Estimate based on historical yield records. Actual future yields may differ."
        );

        const labels = history.map(item => item.year);
        labels.push(prediction.year);

        const historicalValues = history.map(item => item.yield);
        historicalValues.push(null);

        const predictionValues = history.map(() => null);
        predictionValues[predictionValues.length - 1] =
            prediction.latest_yield;
        predictionValues.push(prediction.yield);

        charts.prediction = createChart("predictionChart", {
            type: "line",

            data: {
                labels: labels,

                datasets: [
                    {
                        label: "Recorded Yield",
                        data: historicalValues,
                        borderColor: "#23834e",
                        backgroundColor: "rgba(35,131,78,0.12)",
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true,
                        spanGaps: false
                    },
                    {
                        label: "Predicted Yield",
                        data: predictionValues,
                        borderColor: "#e39b32",
                        backgroundColor: "rgba(227,155,50,0.12)",
                        borderWidth: 3,
                        borderDash: [7, 5],
                        pointRadius: 5,
                        tension: 0.2,
                        fill: false,
                        spanGaps: false
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: true
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Yield (Kg per hectare)"
                        }
                    },

                    x: {
                        title: {
                            display: true,
                            text: "Production Year"
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Yield prediction error:", error);

        setText(
            "predictionMessage",
            error.message || "Unable to generate prediction."
        );
    }
}
// =====================================
// CLIMATE ANALYSIS
// =====================================

async function loadClimateAnalysis() {

    try {

        const [summary, trends, regions] = await Promise.all([
            fetchJSON("/api/climate/summary"),
            fetchJSON("/api/climate/trends"),
            fetchJSON("/api/climate/regions")
        ]);

        const data = summary.data;

        // Summary cards

        setText("climateRecords", formatNumber(data.total_records));
        setText("climateDistricts", formatNumber(data.total_districts));

        setText(
            "climateRainfall",
            data.average_rainfall == null
                ? "N/A"
                : formatNumber(data.average_rainfall) + " mm"
        );

        setText(
            "climateTemperature",
            data.average_temperature == null
                ? "N/A"
                : formatNumber(data.average_temperature) + " °C"
        );


        // Yearly climate trends

        const yearlyData = trends.data;

        if (!yearlyData.length) {
            showChartError(
                "climateRainfallChart",
                "No rainfall records available."
            );

            showChartError(
                "climateTemperatureChart",
                "No temperature records available."
            );

        } else {

            const years = yearlyData.map(item => item.climate_year);

            if (charts.climateRainfall) {
                charts.climateRainfall.destroy();
            }

            charts.climateRainfall = createChart(
                "climateRainfallChart",
                {
                    type: "line",

                    data: {
                        labels: years,

                        datasets: [{
                            label: "Average Rainfall (mm)",

                            data: yearlyData.map(item =>
                                item.average_rainfall == null
                                    ? null
                                    : Number(item.average_rainfall)
                            ),

                            borderColor: "#398bce",
                            backgroundColor: "rgba(57,139,206,0.12)",
                            fill: true,
                            tension: 0.35,
                            borderWidth: 3
                        }]
                    },

                    options: {
                        responsive: true,
                        maintainAspectRatio: false,

                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: "Rainfall (mm)"
                                }
                            }
                        }
                    }
                }
            );


            if (charts.climateTemperature) {
                charts.climateTemperature.destroy();
            }

            charts.climateTemperature = createChart(
                "climateTemperatureChart",
                {
                    type: "line",

                    data: {
                        labels: years,

                        datasets: [{
                            label: "Average Temperature (°C)",

                            data: yearlyData.map(item =>
                                item.average_temperature == null
                                    ? null
                                    : Number(item.average_temperature)
                            ),

                            borderColor: "#e58b45",
                            backgroundColor: "rgba(229,139,69,0.12)",
                            fill: true,
                            tension: 0.35,
                            borderWidth: 3
                        }]
                    },

                    options: {
                        responsive: true,
                        maintainAspectRatio: false,

                        scales: {
                            y: {
                                title: {
                                    display: true,
                                    text: "Temperature (°C)"
                                }
                            }
                        }
                    }
                }
            );
        }


        // Regional comparison

        const regionData = regions.data;

        if (!regionData.length) {

            showChartError(
                "climateRegionChart",
                "No regional climate records available."
            );

        } else {

            if (charts.climateRegion) {
                charts.climateRegion.destroy();
            }

            charts.climateRegion = createChart(
                "climateRegionChart",
                {
                    type: "bar",

                    data: {
                        labels: regionData.map(item => item.region_name),

                        datasets: [
                            {
                                label: "Average Rainfall (mm)",

                                data: regionData.map(item =>
                                    item.average_rainfall == null
                                        ? null
                                        : Number(item.average_rainfall)
                                ),

                                backgroundColor: "#398bce",
                                yAxisID: "y"
                            },

                            {
                                label: "Average Temperature (°C)",

                                data: regionData.map(item =>
                                    item.average_temperature == null
                                        ? null
                                        : Number(item.average_temperature)
                                ),

                                backgroundColor: "#e58b45",
                                yAxisID: "y1"
                            }
                        ]
                    },

                    options: {
                        responsive: true,
                        maintainAspectRatio: false,

                        scales: {
                            y: {
                                type: "linear",
                                position: "left",
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: "Rainfall (mm)"
                                }
                            },

                            y1: {
                                type: "linear",
                                position: "right",
                                grid: {
                                    drawOnChartArea: false
                                },
                                title: {
                                    display: true,
                                    text: "Temperature (°C)"
                                }
                            }
                        }
                    }
                }
            );
        }


        // Regional climate table

        const tableBody = document.getElementById("climateTableBody");

        if (tableBody) {

            tableBody.replaceChildren();

            regionData.forEach(region => {

                const row = document.createElement("tr");

                const values = [
                    region.region_name,
                    formatNumber(region.total_districts),
                    formatNumber(region.total_records),
                    region.average_rainfall == null
                        ? "N/A"
                        : formatNumber(region.average_rainfall),
                    region.average_temperature == null
                        ? "N/A"
                        : formatNumber(region.average_temperature)
                ];

                values.forEach(value => {

                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);

                });

                tableBody.appendChild(row);

            });
        }

        console.log("Climate analysis loaded successfully.");

    } catch (error) {

        console.error("Climate analysis error:", error);

        setText("climateRecords", "Unavailable");
        setText("climateRainfall", "Unavailable");
        setText("climateTemperature", "Unavailable");
        setText("climateDistricts", "Unavailable");

        const tableBody = document.getElementById("climateTableBody");

        if (tableBody) {
            tableBody.innerHTML =
                '<tr><td colspan="5">Unable to load climate data.</td></tr>';
        }
    }
}
// =====================================
// DISTRICT ANALYSIS
// =====================================

async function loadDistrictFilters() {

    const result = await fetchJSON("/api/districts/filters");

    const cropFilter = document.getElementById("districtCropFilter");
    const yearFilter = document.getElementById("districtYearFilter");

    if (cropFilter) {

        cropFilter.replaceChildren(
            new Option("All Crops", "")
        );

        result.crops.forEach(crop => {
            cropFilter.add(
                new Option(crop.crop_name, crop.crop_id)
            );
        });
    }

    if (yearFilter) {

        yearFilter.replaceChildren(
            new Option("All Years", "")
        );

        result.years.forEach(item => {
            yearFilter.add(
                new Option(item.production_year, item.production_year)
            );
        });
    }
}


async function loadDistrictAnalysis() {

    const message = document.getElementById("districtMessage");
    const tableBody = document.getElementById("districtTableBody");

    try {

        const cropId = document.getElementById(
            "districtCropFilter"
        ).value;

        const year = document.getElementById(
            "districtYearFilter"
        ).value;

        const params = new URLSearchParams();

        if (cropId) params.set("crop_id", cropId);
        if (year) params.set("year", year);

        const result = await fetchJSON(
            `/api/districts/analysis?${params.toString()}`
        );

        const districts = result.data;

        if (charts.district) {
            charts.district.destroy();
            charts.district = null;
        }

        if (tableBody) {
            tableBody.replaceChildren();
        }

        if (!districts.length) {

            setText("districtCount", "0");
            setText("districtProduction", "0");
            setText("districtArea", "0");
            setText("districtYield", "0");

            if (message) {
                message.textContent = "No district records found for these filters.";
            }

            if (tableBody) {
                const row = document.createElement("tr");
                const cell = document.createElement("td");

                cell.colSpan = 7;
                cell.textContent = "No matching district records found.";

                row.appendChild(cell);
                tableBody.appendChild(row);
            }

            return;
        }

        // Calculate national totals for selected filters

        const totalProduction = districts.reduce(
            (sum, item) =>
                sum + Number(item.total_production || 0),
            0
        );

        const totalArea = districts.reduce(
            (sum, item) =>
                sum + Number(item.total_area || 0),
            0
        );

        const weightedYield = totalArea > 0
            ? totalProduction * 1000 / totalArea
            : 0;


        // Update summary cards

        setText("districtCount", districts.length);

        setText(
            "districtProduction",
            formatNumber(totalProduction)
        );

        setText(
            "districtArea",
            formatNumber(totalArea)
        );

        setText(
            "districtYield",
            formatNumber(weightedYield)
        );


        // Update status message

        if (message) {
            message.textContent =
                `Showing ${districts.length} districts with matching production records.`;
        }


        // Build district table

        districts.forEach((district, index) => {

            const row = document.createElement("tr");

            const values = [
                index + 1,
                district.district_name,
                district.region_name,
                formatNumber(district.total_crops),
                formatNumber(district.total_production),
                formatNumber(district.total_area),
                formatNumber(district.weighted_yield)
            ];

            values.forEach(value => {

                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);

            });

            tableBody.appendChild(row);

        });


        // Build top 15 production chart

        const topDistricts = districts.slice(0, 15);

        charts.district = createChart("districtChart", {

            type: "bar",

            data: {

                labels: topDistricts.map(
                    item => item.district_name
                ),

                datasets: [{

                    label: "Production (Tonnes)",

                    data: topDistricts.map(
                        item => Number(item.total_production || 0)
                    ),

                    backgroundColor: "#398b5d",
                    borderRadius: 6

                }]

            },

            options: {

                indexAxis: "y",

                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {

                    x: {
                        beginAtZero: true,

                        title: {
                            display: true,
                            text: "Production (Tonnes)"
                        }
                    }

                }

            }

        });

        console.log("District analysis loaded.");

    } catch (error) {

        console.error("District analysis error:", error);

        setText("districtCount", "Unavailable");
        setText("districtProduction", "Unavailable");
        setText("districtArea", "Unavailable");
        setText("districtYield", "Unavailable");

        if (message) {
            message.textContent = "Unable to load district analysis.";
        }

        if (tableBody) {

            tableBody.replaceChildren();

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 7;
            cell.textContent = "Unable to load district data.";

            row.appendChild(cell);
            tableBody.appendChild(row);
        }
    }
}

// =====================================
// INITIALIZE CURRENT PAGE
// =====================================

async function initializePage() {
    console.log("FLORA page:", currentPage);

    if (currentPage === "dashboard") {
        await loadSummary();
    }

    else if (currentPage === "regional") {
        await loadRegionalAnalysis();
    }

    else if (currentPage === "trends") {
        try {
            await loadFilters();
        } catch (error) {
            console.error("Filter loading error:", error);
        }

        await loadProductionChart();

        const filter = document.getElementById("cropFilter");

        if (filter) {
            filter.addEventListener("change", loadProductionChart);
        }
    }

    else if (currentPage === "comparison") {
        try {
            await loadFilters();
        } catch (error) {
            console.error("Filter loading error:", error);
        }

        await loadCropChart();

        const filter = document.getElementById("yearFilter");

        if (filter) {
            filter.addEventListener("change", loadCropChart);
        }
    }

else if (currentPage === "statistics") {
    await loadSummary();

    await Promise.all([
        loadStatisticsTrend(),
        loadStatisticsCropChart()
    ]);
}
else if (currentPage === "prediction") {
    try {
        await loadPredictionFilters();

        const button = document.getElementById("predictionButton");

        if (button) {
            button.addEventListener("click", loadYieldPrediction);
        }

        const cropSelect = document.getElementById("predictionCrop");
        const regionSelect = document.getElementById("predictionRegion");

        if (cropSelect) {
            cropSelect.addEventListener("change", loadYieldPrediction);
        }

        if (regionSelect) {
            regionSelect.addEventListener("change", loadYieldPrediction);
        }

    } catch (error) {
        console.error("Prediction page error:", error);
        setText("predictionMessage", "Unable to load prediction filters.");
    }
}
else if (currentPage === "districts") {

    try {
        await loadDistrictFilters();
    } catch (error) {
        console.error("District filter error:", error);
    }

    await loadDistrictAnalysis();

    const cropFilter = document.getElementById(
        "districtCropFilter"
    );

    const yearFilter = document.getElementById(
        "districtYearFilter"
    );

    if (cropFilter) {
        cropFilter.addEventListener(
            "change",
            loadDistrictAnalysis
        );
    }

    if (yearFilter) {
        yearFilter.addEventListener(
            "change",
            loadDistrictAnalysis
        );
    }
}
else if (currentPage === "climate") {
    await loadClimateAnalysis();
}
else if (currentPage === "districts") {

    try {
        await loadDistrictFilters();
    } catch (error) {
        console.error("District filter error:", error);
    }

    await loadDistrictAnalysis();

    document.getElementById("districtCropFilter")
        ?.addEventListener("change", loadDistrictAnalysis);

    document.getElementById("districtYearFilter")
        ?.addEventListener("change", loadDistrictAnalysis);

    document.getElementById("districtResetButton")
        ?.addEventListener("click", () => {

            document.getElementById("districtCropFilter").value = "";
            document.getElementById("districtYearFilter").value = "";

            loadDistrictAnalysis();
        });
}
    console.log("FLORA initialization complete.");
}

/* =====================================
   STATISTICS PAGE
===================================== */

async function loadStatisticsTrend() {
    try {
        const result = await fetchJSON(
            "/api/dashboard/filtered-trend"
        );

        if (charts.statisticsTrend) {
            charts.statisticsTrend.destroy();
            charts.statisticsTrend = null;
        }

        if (!result.data || result.data.length === 0) {
            showChartError(
                "statisticsTrendChart",
                "No annual production records found."
            );
            return;
        }

        charts.statisticsTrend = createChart(
            "statisticsTrendChart",
            {
                type: "line",

                data: {
                    labels: result.data.map(
                        item => item.production_year
                    ),

                    datasets: [{
                        label: "Total Production (Tonnes)",

                        data: result.data.map(
                            item => Number(item.total_production || 0)
                        ),

                        borderColor: "#23834e",
                        backgroundColor: "rgba(35,131,78,0.12)",
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3,
                        pointRadius: 4
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: true
                        }
                    },

                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Production (Tonnes)"
                            }
                        },

                        x: {
                            title: {
                                display: true,
                                text: "Production Year"
                            }
                        }
                    }
                }
            }
        );

    } catch (error) {
        console.error("Statistics trend error:", error);

        showChartError(
            "statisticsTrendChart",
            "Unable to load annual production statistics."
        );
    }
}


async function loadStatisticsCropChart() {
    try {
        const result = await fetchJSON(
            "/api/dashboard/filtered-crops"
        );

        if (charts.statisticsCrops) {
            charts.statisticsCrops.destroy();
            charts.statisticsCrops = null;
        }

        if (!result.data || result.data.length === 0) {
            showChartError(
                "statisticsCropChart",
                "No crop statistics found."
            );
            return;
        }

        charts.statisticsCrops = createChart(
            "statisticsCropChart",
            {
                type: "bar",

                data: {
                    labels: result.data.map(
                        item => item.crop_name
                    ),

                    datasets: [{
                        label: "Production (Tonnes)",

                        data: result.data.map(
                            item => Number(item.total_production || 0)
                        ),

                        backgroundColor: [
                            "#256b45",
                            "#398b5d",
                            "#57a879",
                            "#78bd92",
                            "#a0d0ae",
                            "#4b8261",
                            "#89a994",
                            "#315c43",
                            "#b1c9b6"
                        ],

                        borderRadius: 6
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    },

                    scales: {
                        y: {
                            beginAtZero: true,

                            title: {
                                display: true,
                                text: "Production (Tonnes)"
                            }
                        },

                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 0
                            }
                        }
                    }
                }
            }
        );

    } catch (error) {
        console.error("Statistics crop error:", error);

        showChartError(
            "statisticsCropChart",
            "Unable to load crop production statistics."
        );
    }
}


// =====================================
// START APPLICATION
// =====================================

initializePage();
