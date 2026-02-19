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

  public async fetchAndInsertReading(): Promise<{
    insertResult: PromiseSettledResult<PutObjectCommandOutput>[];
    reading: Device;
    partitionStatus: AthenaPartitionStatus;
  }> {
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
      partitionStatus,
    };
  }

  private async addAthenaPartitions(reading: Device): Promise<AthenaPartitionStatus> {
    const partitionSet = new Set<string>();
    for (const obs of reading.observations) {
      partitionSet.add(partitionDateKeyUtc(new Date(obs.dateTime * 1000)));
    }

    const partitions = Array.from(partitionSet).map((key) => {
      const [year, month, day, hour] = key.split('-');

      return { year, month, day, hour };
    });

    try {
      const result = await this.database.addObservationsPartitions(partitions);
      if (result) {
        return { succeeded: partitions.length, failed: 0 };
      }

      return { succeeded: 0, failed: partitions.length };
    } catch (error) {
      console.error('Athena partition update threw error', {
        partitions,
        error,
      });
      return { succeeded: 0, failed: partitions.length };
    }
  }
}
