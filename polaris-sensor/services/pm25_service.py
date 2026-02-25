import smbus2

from logger import get_logger

I2C_BUS = 1
I2C_ADDRESS = 0x19
REGISTER = 0x00
READ_LENGTH = 32

_logger = get_logger("services.pm25")


def read_pm():
    """Read PM1.0, PM2.5, and PM10 values from the I2C particulate matter sensor.

    Returns little-endian uint16 values from register 0x00 at offsets 6-11.
    """
    _logger.info(
        "Opening I2C  bus=%d addr=0x%02X reg=0x%02X len=%d",
        I2C_BUS,
        I2C_ADDRESS,
        REGISTER,
        READ_LENGTH,
    )
    bus = smbus2.SMBus(I2C_BUS)
    try:
        data = bus.read_i2c_block_data(I2C_ADDRESS, REGISTER, READ_LENGTH)

        pm1_0 = data[6] | (data[7] << 8)
        pm2_5 = data[8] | (data[9] << 8)
        pm10 = data[10] | (data[11] << 8)

        _logger.info(
            "I2C read OK  raw[6:12]=%s  pm1_0=%d pm2_5=%d pm10=%d",
            list(data[6:12]),
            pm1_0,
            pm2_5,
            pm10,
        )

        return {
            "pm1_0": pm1_0,
            "pm2_5": pm2_5,
            "pm10": pm10,
            "unit": "μg/m³",
        }
    finally:
        bus.close()
