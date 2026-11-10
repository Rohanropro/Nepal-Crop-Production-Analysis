import os

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from mysql.connector import Error

load_dotenv()

app = Flask(__name__)


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "NepalAgriculture"),
        connection_timeout=5
    )


def close_db(connection, cursor):
    if cursor is not None:
        cursor.close()

    if connection is not None and connection.is_connected():
        connection.close()


# =========================================================
# WEBSITE PAGES
# =========================================================

@app.route("/")
def dashboard_page():
    return render_template("index.html", page="dashboard")


@app.route("/trends")
def trends_page():
    return render_template("index.html", page="trends")


@app.route("/comparison")
def comparison_page():
    return render_template("index.html", page="comparison")


@app.route("/statistics")
def statistics_page():
    return render_template("index.html", page="statistics")


@app.route("/prediction")
def prediction_page():
    return render_template("index.html", page="prediction")


@app.route("/climate")
def climate_page():
    return render_template("index.html", page="climate")


@app.route("/regional")
def regional_page():
    return render_template("index.html", page="regional")


@app.route("/districts")
def districts_page():
    return render_template("index.html", page="districts")


# =========================================================
# HEALTH CHECK AND DATABASE TEST
# =========================================================

@app.route("/api/health")
def health():
    return jsonify({
        "status": "success",
        "message": "Backend is running"
    })


@app.route("/api/db-test")
def db_test():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")

        tables = [row[0] for row in cursor.fetchall()]

        return jsonify({
            "status": "success",
            "connection": "connected",
            "tables": tables
        })

    except Error as error:
        app.logger.exception("Database test failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# DASHBOARD SUMMARY
# =========================================================

@app.route("/api/dashboard/summary")
def dashboard_summary():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                COUNT(*) AS total_records,
                COUNT(DISTINCT crop_id) AS total_crops,
                COUNT(DISTINCT district_id) AS total_districts,
                COALESCE(SUM(cultivated_area_hectares), 0) AS total_area,
                COALESCE(SUM(production_tonnes), 0) AS total_production,
                CASE
                    WHEN SUM(cultivated_area_hectares) > 0
                    THEN SUM(production_tonnes) * 1000
                         / SUM(cultivated_area_hectares)
                    ELSE 0
                END AS weighted_yield
            FROM production_records
        """)

        return jsonify({
            "status": "success",
            "data": cursor.fetchone()
        })

    except Error as error:
        app.logger.exception("Dashboard summary failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# DASHBOARD FILTERS
# =========================================================

@app.route("/api/dashboard/filters")
def dashboard_filters():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT crop_id, crop_name
            FROM crops
            WHERE crop_id IN (
                SELECT DISTINCT crop_id
                FROM production_records
            )
            ORDER BY crop_name
        """)

        crops = cursor.fetchall()

        cursor.execute("""
            SELECT DISTINCT production_year
            FROM production_records
            ORDER BY production_year
        """)

        years = cursor.fetchall()

        return jsonify({
            "status": "success",
            "crops": crops,
            "years": years
        })

    except Error as error:
        app.logger.exception("Dashboard filters failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# FILTERED PRODUCTION TREND
# =========================================================

@app.route("/api/dashboard/filtered-trend")
def filtered_trend():
    connection = None
    cursor = None

    try:
        crop_id = request.args.get("crop_id", type=int)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                production_year,
                SUM(production_tonnes) AS total_production,
                SUM(cultivated_area_hectares) AS total_area
            FROM production_records
        """

        params = []

        if crop_id is not None:
            query += " WHERE crop_id = %s"
            params.append(crop_id)

        query += """
            GROUP BY production_year
            ORDER BY production_year
        """

        cursor.execute(query, params)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("Filtered trend failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# FILTERED CROP COMPARISON
# =========================================================

@app.route("/api/dashboard/filtered-crops")
def filtered_crops():
    connection = None
    cursor = None

    try:
        year = request.args.get("year", type=int)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                c.crop_name,
                SUM(p.production_tonnes) AS total_production,
                SUM(p.cultivated_area_hectares) AS total_area
            FROM production_records p
            INNER JOIN crops c
                ON p.crop_id = c.crop_id
        """

        params = []

        if year is not None:
            query += " WHERE p.production_year = %s"
            params.append(year)

        query += """
            GROUP BY c.crop_id, c.crop_name
            ORDER BY total_production DESC
        """

        cursor.execute(query, params)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("Filtered crop comparison failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# REGIONAL ANALYSIS
# =========================================================

@app.route("/api/regional/summary")
def regional_summary():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                r.region_id,
                r.region_name,
                COUNT(DISTINCT d.district_id) AS total_districts,
                COUNT(DISTINCT p.crop_id) AS total_crops,
                COALESCE(SUM(p.production_tonnes), 0) AS total_production,
                COALESCE(SUM(p.cultivated_area_hectares), 0) AS total_area,
                CASE
                    WHEN SUM(p.cultivated_area_hectares) > 0
                    THEN SUM(p.production_tonnes) * 1000
                         / SUM(p.cultivated_area_hectares)
                    ELSE 0
                END AS weighted_yield
            FROM ecological_regions r
            LEFT JOIN districts d
                ON r.region_id = d.region_id
            LEFT JOIN production_records p
                ON d.district_id = p.district_id
            GROUP BY r.region_id, r.region_name
            ORDER BY r.region_id
        """)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("Regional summary failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# DISTRICT FILTERS
# =========================================================

@app.route("/api/districts/filters")
def district_filters():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT crop_id, crop_name
            FROM crops
            WHERE crop_id IN (
                SELECT DISTINCT crop_id
                FROM production_records
            )
            ORDER BY crop_name
        """)

        crops = cursor.fetchall()

        cursor.execute("""
            SELECT DISTINCT production_year
            FROM production_records
            ORDER BY production_year DESC
        """)

        years = cursor.fetchall()

        return jsonify({
            "status": "success",
            "crops": crops,
            "years": years
        })

    except Error as error:
        app.logger.exception("District filters failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# DISTRICT AGRICULTURAL ANALYSIS
# =========================================================

@app.route("/api/districts/analysis")
def district_analysis():
    connection = None
    cursor = None

    try:
        crop_id = request.args.get("crop_id", type=int)
        year = request.args.get("year", type=int)

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                d.district_id,
                d.district_name,
                r.region_name,
                COUNT(DISTINCT p.crop_id) AS total_crops,
                COALESCE(SUM(p.production_tonnes), 0) AS total_production,
                COALESCE(SUM(p.cultivated_area_hectares), 0) AS total_area,
                CASE
                    WHEN SUM(p.cultivated_area_hectares) > 0
                    THEN SUM(p.production_tonnes) * 1000
                         / SUM(p.cultivated_area_hectares)
                    ELSE 0
                END AS weighted_yield
            FROM districts d
            INNER JOIN ecological_regions r
                ON d.region_id = r.region_id
            LEFT JOIN production_records p
                ON d.district_id = p.district_id
            WHERE 1 = 1
        """

        params = []

        if crop_id is not None:
            query += " AND p.crop_id = %s"
            params.append(crop_id)

        if year is not None:
            query += " AND p.production_year = %s"
            params.append(year)

        query += """
            GROUP BY
                d.district_id,
                d.district_name,
                r.region_name
            ORDER BY total_production DESC
        """

        cursor.execute(query, params)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("District analysis failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# CROP YIELD PREDICTION FILTERS
# =========================================================

@app.route("/api/prediction/filters")
def prediction_filters():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT crop_id, crop_name
            FROM crops
            WHERE crop_id IN (
                SELECT DISTINCT crop_id
                FROM production_records
            )
            ORDER BY crop_name
        """)

        crops = cursor.fetchall()

        cursor.execute("""
            SELECT region_id, region_name
            FROM ecological_regions
            ORDER BY region_id
        """)

        regions = cursor.fetchall()

        return jsonify({
            "status": "success",
            "crops": crops,
            "regions": regions
        })

    except Error as error:
        app.logger.exception("Prediction filters failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# CROP YIELD PREDICTION
# =========================================================

@app.route("/api/prediction/yield")
def predict_yield():
    connection = None
    cursor = None

    try:
        crop_id = request.args.get("crop_id", type=int)
        region_id = request.args.get("region_id", type=int)

        if crop_id is None:
            return jsonify({
                "status": "error",
                "message": "Please select a crop."
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                p.production_year,
                SUM(p.production_tonnes) AS total_production,
                SUM(p.cultivated_area_hectares) AS total_area,
                CASE
                    WHEN SUM(p.cultivated_area_hectares) > 0
                    THEN SUM(p.production_tonnes) * 1000
                         / SUM(p.cultivated_area_hectares)
                    ELSE NULL
                END AS yield_kg_per_hectare
            FROM production_records p
            INNER JOIN districts d
                ON p.district_id = d.district_id
            WHERE p.crop_id = %s
        """

        params = [crop_id]

        if region_id is not None:
            query += " AND d.region_id = %s"
            params.append(region_id)

        query += """
            GROUP BY p.production_year
            HAVING SUM(p.cultivated_area_hectares) > 0
            ORDER BY p.production_year
        """

        cursor.execute(query, params)
        rows = cursor.fetchall()

        history = []

        for row in rows:
            history.append({
                "year": int(row["production_year"]),
                "production": float(row["total_production"] or 0),
                "area": float(row["total_area"] or 0),
                "yield": float(row["yield_kg_per_hectare"])
            })

        if len(history) < 2:
            return jsonify({
                "status": "success",
                "data": history,
                "prediction": None,
                "message": "At least two years of valid records are required."
            })

        years = [item["year"] for item in history]
        yields = [item["yield"] for item in history]

        mean_x = sum(years) / len(years)
        mean_y = sum(yields) / len(yields)

        denominator = sum(
            (x - mean_x) ** 2 for x in years
        )

        if denominator == 0:
            return jsonify({
                "status": "success",
                "data": history,
                "prediction": None,
                "message": "Not enough variation in recorded years."
            })

        slope = sum(
            (x - mean_x) * (y - mean_y)
            for x, y in zip(years, yields)
        ) / denominator

        intercept = mean_y - slope * mean_x

        forecast_year = max(years) + 1

        predicted_yield = max(
            0,
            slope * forecast_year + intercept
        )

        latest_yield = yields[-1]

        change_percent = (
            ((predicted_yield - latest_yield) / latest_yield) * 100
            if latest_yield > 0 else None
        )

        return jsonify({
            "status": "success",
            "data": history,
            "prediction": {
                "year": forecast_year,
                "yield": round(predicted_yield, 2),
                "latest_yield": round(latest_yield, 2),
                "change_percent": (
                    round(change_percent, 2)
                    if change_percent is not None else None
                ),
                "trend": (
                    "Increasing" if slope > 0
                    else "Decreasing" if slope < 0
                    else "Stable"
                )
            },
            "message": "Prediction calculated from historical yield records."
        })

    except Error as error:
        app.logger.exception("Yield prediction failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# CLIMATE ANALYSIS SUMMARY
# =========================================================

@app.route("/api/climate/summary")
def climate_summary():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                COUNT(*) AS total_records,
                COUNT(DISTINCT district_id) AS total_districts,
                COUNT(DISTINCT climate_year) AS total_years,
                MIN(climate_year) AS first_year,
                MAX(climate_year) AS latest_year,
                AVG(annual_rainfall_mm) AS average_rainfall,
                AVG(average_temperature_celsius) AS average_temperature
            FROM climate_records
        """)

        return jsonify({
            "status": "success",
            "data": cursor.fetchone()
        })

    except Error as error:
        app.logger.exception("Climate summary failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# YEARLY CLIMATE TRENDS
# =========================================================

@app.route("/api/climate/trends")
def climate_trends():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                climate_year,
                AVG(annual_rainfall_mm) AS average_rainfall,
                AVG(average_temperature_celsius) AS average_temperature,
                COUNT(*) AS total_records
            FROM climate_records
            GROUP BY climate_year
            ORDER BY climate_year
        """)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("Climate trends failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# REGIONAL CLIMATE COMPARISON
# =========================================================

@app.route("/api/climate/regions")
def climate_regions():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                r.region_id,
                r.region_name,
                COUNT(DISTINCT d.district_id) AS total_districts,
                COUNT(cr.climate_id) AS total_records,
                AVG(cr.annual_rainfall_mm) AS average_rainfall,
                AVG(cr.average_temperature_celsius) AS average_temperature
            FROM ecological_regions r
            LEFT JOIN districts d
                ON r.region_id = d.region_id
            LEFT JOIN climate_records cr
                ON d.district_id = cr.district_id
            GROUP BY
                r.region_id,
                r.region_name
            ORDER BY r.region_id
        """)

        return jsonify({
            "status": "success",
            "data": cursor.fetchall()
        })

    except Error as error:
        app.logger.exception("Climate regional comparison failed")

        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    finally:
        close_db(connection, cursor)


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )