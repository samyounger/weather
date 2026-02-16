import { PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { Database, partitionDateKeyUtc } from '@weather/cloud-computing';
import { Device } from "../models";
import { ObservationsService } from "./observations-service";

type AthenaPartitionStatus = {
  succeeded: number;
  failed: number;
};

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

    const partitionStatus = await this.addAthenaPartitions(reading);
    console.debug('athena partitions: ', partitionStatus);

    return {
      insertResult,
      reading,
    };
  }

  private async addAthenaPartitions(reading: Device): Promise<AthenaPartitionStatus> {
    const partitionSet = new Set<string>();
    for (const obs of reading.observations) {
      partitionSet.add(partitionDateKeyUtc(new Date(obs.dateTime * 1000)));
    }

    let succeeded = 0;
    let failed = 0;
    for (const key of partitionSet) {
      const [year, month, day, hour] = key.split('-');
      try {
        const result = await this.database.addObservationsPartition(year, month, day, hour);
        if (result) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return { succeeded, failed };
  }
}
