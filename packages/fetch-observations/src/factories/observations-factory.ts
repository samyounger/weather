import { GetQueryResultsOutput, Row } from "@aws-sdk/client-athena";

export class ObservationsFactory {
  public static build = (queryResults: GetQueryResultsOutput): ((string | undefined)[] | undefined)[] | undefined => (
    queryResults.ResultSet?.Rows
      ?.slice(1)
      ?.map((row: Row) => {
        if (!row.Data) {
          return undefined;
        }
        return row.Data.map((columnRow) => columnRow.VarCharValue);
      })
  );
}
