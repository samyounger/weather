import { PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { Database, partitionDateKeyUtc } from '@weather/cloud-computing';
import { Device } from "../models";
import { ObservationsService } from "./observations-service";

export class DeviceObservationsService {
  public constructor(
    private readonly observationsService: ObservationsService,
    private readonly database: Database,
  ) {}

  public async fetchAndInsertReading(): Promise<{ insertResult: PromiseSettledResult<PutObjectCommandOutput>[], reading: Device }> {
    const reading = await this.observationsService.readObservation();
    console.debug('readings: ', { ...reading, observations: reading.observations.length });
    console.debug('inserting readings: ', reading.observations.map((obs) => obs.dateTime.toString()));
    const readingInserts = reading.observations.map((obs): Promise<PutObjectCommandOutput> => {
      const fileName = obs.dateTime.toString() + '.json';
      return this.observationsService.insertReading(obs, fileName);
    });
    const insertResult = await Promise.allSettled(readingInserts);
    console.debug('inserted readings: ', insertResult.length);

    await this.addAthenaPartitions(reading);

    return {
      insertResult,
      reading,
    };
  }

  private async addAthenaPartitions(reading: Device): Promise<void> {
    const partitionSet = new Set<string>();
    for (const obs of reading.observations) {
      partitionSet.add(partitionDateKeyUtc(new Date(obs.dateTime * 1000)));
    }

    for (const key of partitionSet) {
      const [year, month, day, hour] = key.split('-');
      await this.database.addObservationsPartition(year, month, day, hour);
    }
  }
}
