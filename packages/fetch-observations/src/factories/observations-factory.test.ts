import { GetQueryResultsOutput } from "@aws-sdk/client-athena";
import { ObservationsFactory } from "./observations-factory";

const mockData: GetQueryResultsOutput = {
  ResultSet: {
    Rows: [
      {
        Data: [
          {
            VarCharValue: 'columnHeader1',
          },
          {
            VarCharValue: 'columnHeader2',
          },
          {
            VarCharValue: 'columnHeader3',
          },
        ],
      },
      {
        Data: [
          {
            VarCharValue: 'column1Value1',
          },
          {
            VarCharValue: 'column1Value2',
          },
          {
            VarCharValue: 'column1Value3',
          },
        ],
      },
      {
        Data: [
          {
            VarCharValue: 'column2Value1',
          },
          {
            VarCharValue: 'column2Value2',
          },
          {
            VarCharValue: 'column2Value3',
          },
        ],
      },
    ],
  },
};

describe('ObservationsFactory', () => {
  describe('.build', () => {
    describe('when there is row data', () => {
      it('should return formatted columns', () => {
        expect(ObservationsFactory.build(mockData)).toEqual([
          ['columnHeader1', 'columnHeader2', 'columnHeader3'],
          ['column1Value1', 'column1Value2', 'column1Value3'],
          ['column2Value1', 'column2Value2', 'column2Value3'],
        ]);
      });
    });

    describe('when there is no row data', () => {
      const mockDataWithNoRows = {
        ResultSet: {
          Rows: [],
        },
      };

      it('should return an empty array', () => {
        expect(ObservationsFactory.build(mockDataWithNoRows)).toEqual([]);
      });
    });

    describe('when a row has no data', () => {
      const mockDataWithNoData = {
        ResultSet: {
          Rows: [
            {
              Data: undefined,
            },
          ],
        },
      };

      it('should return an empty array', () => {
        expect(ObservationsFactory.build(mockDataWithNoData)).toEqual([undefined]);
      });
    });

    describe('when result set is missing', () => {
      it('should return undefined', () => {
        expect(ObservationsFactory.build({})).toBeUndefined();
      });
    });

    describe('when rows are missing', () => {
      it('should return undefined', () => {
        expect(ObservationsFactory.build({ ResultSet: {} })).toBeUndefined();
      });
    });
  });
});
