lena@nordlicht:~/code $ cat pm25_test.py
#!/usr/bin/env python3
import smbus
import time

I2C_ADDRESS = 0x19
bus = smbus.SMBus(1)

def read_pm_sensor():
try: # Read from register 0x00
data = bus.read_i2c_block_data(I2C_ADDRESS, 0x00, 32)

        # LITTLE-ENDIAN: low byte first, high byte second
        pm1_0 = data[6] | (data[7] << 8)   # 0x48 0x00 = 72
        pm2_5 = data[8] | (data[9] << 8)   # 0x6B 0x00 = 107
        pm10 = data[10] | (data[11] << 8)  # 0x71 0x00 = 113

        return pm1_0, pm2_5, pm10

    except Exception as e:
        print(f"Error: {e}")
        return None, None, None

print("Reading PM2.5 sensor (corrected byte order)...")
print("Expected Hanoi PM2.5: ~87 μg/m³\n")

try:
while True:
pm1, pm25, pm10 = read_pm_sensor()

        if pm1 is not None:
            print(f"PM1.0: {pm1:3d} μg/m³  |  PM2.5: {pm25:3d} μg/m³  |  PM10: {pm10:3d} μg/m³")

        time.sleep(2)


except KeyboardInterrupt:
print("\nStopped")
lena@nordlicht:~/code $ cd temp_test
-bash: cd: temp_test: No such file or directory
lena@nordlicht:~/code $ ls
output.txt pm25_test.py temp-test
lena@nordlicht:~/code $ cd temp-test
lena@nordlicht:~/code/temp-test $ ls
dht.py
lena@nordlicht:~/code/temp-test $ cat dht.py
import adafruit_dht
import board
import time

sensor = adafruit_dht.DHT11(board.D4) # or DHT11 if that's your model

while True:
try:
print(f"Temp: {sensor.temperature}°C Humidity: {sensor.humidity}%")
except RuntimeError as e:
print(f"Read error (normal occasionally): {e}")
time.sleep(2)
lena@nordlicht:~/code/temp-test $
