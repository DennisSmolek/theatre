/*
 * @jest-environment jsdom
 */
import {setupTestSheet} from '@theatre/shared/testUtils'
import {encodePathToProp} from '@theatre/shared/utils/addresses'
import {asKeyframeId, asSequenceTrackId} from '@theatre/shared/utils/ids'
import {iterateOver, prism} from '@theatre/dataverse'

describe(`SheetObject`, () => {
  describe('static overrides', () => {
    const setup = async () => {
      const {studio, objPublicAPI} = await setupTestSheet({
        staticOverrides: {
          byObject: {
            obj: {
              position: {
                x: 10,
              },
            },
          },
        },
      })

      const objValues = iterateOver(prism(() => objPublicAPI.value))
      const teardown = () => objValues.return()

      return {studio, objPublicAPI, objValues, teardown}
    }
    test(`should be a deep merge of default values and static overrides`, async () => {
      const {teardown, objValues} = await setup()
      expect(objValues.next().value).toMatchObject({
        position: {x: 10, y: 0, z: 0},
      })
      teardown()
    })

    test(`should allow introducing a static override to a simple prop`, async () => {
      const {teardown, objValues, studio, objPublicAPI} = await setup()
      studio.transaction(({set}) => {
        set(objPublicAPI.props.position.y, 5)
      })

      expect(objValues.next().value).toMatchObject({
        position: {x: 10, y: 5, z: 0},
      })

      teardown()
    })

    test(`should allow introducing a static override to a compound prop`, async () => {
      const {teardown, objValues, studio, objPublicAPI} = await setup()
      studio.transaction(({set}) => {
        set(objPublicAPI.props.position, {x: 1, y: 2, z: 3})
      })

      expect(objValues.next().value).toMatchObject({
        position: {x: 1, y: 2, z: 3},
      })

      teardown()
    })

    test(`should allow removing a static override to a simple prop`, async () => {
      const {teardown, objValues, studio, objPublicAPI} = await setup()
      studio.transaction(({set}) => {
        set(objPublicAPI.props.position, {x: 1, y: 2, z: 3})
      })

      studio.transaction(({unset}) => {
        unset(objPublicAPI.props.position.z)
      })

      expect(objValues.next().value).toMatchObject({
        position: {x: 1, y: 2, z: 0},
      })

      teardown()
    })

    test(`should allow removing a static override to a compound prop`, async () => {
      const {teardown, objValues, studio, objPublicAPI} = await setup()
      studio.transaction(({set}) => {
        set(objPublicAPI.props.position, {x: 1, y: 2, z: 3})
      })

      studio.transaction(({unset}) => {
        unset(objPublicAPI.props.position)
      })

      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 0, z: 0},
      })

      teardown()
    })

    describe(`simple props as json objects`, () => {
      test(`with no overrides`, async () => {
        const {teardown, objValues, studio, objPublicAPI} = await setup()

        expect(objValues.next().value).toMatchObject({
          color: {r: 0, g: 0, b: 0, a: 1},
        })

        teardown()
      })

      describe(`setting overrides`, () => {
        test(`should allow setting an override`, async () => {
          const {teardown, objValues, studio, objPublicAPI} = await setup()
          studio.transaction(({set}) => {
            set(objPublicAPI.props.color, {r: 1, g: 2, b: 3, a: 0.5})
          })

          expect(objValues.next().value).toMatchObject({
            color: {r: 1, g: 2, b: 3, a: 0.5},
          })

          teardown()
        })

        test(`should disallow setting an override on json sub-props`, async () => {
          const {teardown, objValues, studio, objPublicAPI} = await setup()

          // TODO also disallow in typescript
          expect(() => {
            studio.transaction(({set}) => {
              set(objPublicAPI.props.color.r, 1)
            })
          }).toThrow()

          expect(objValues.next().value).toMatchObject({
            color: {r: 0, g: 0, b: 0, a: 1},
          })

          teardown()
        })
      })

      describe(`unsetting overrides`, () => {
        test(`should allow unsetting an override`, async () => {
          const {teardown, objValues, studio, objPublicAPI} = await setup()
          studio.transaction(({set}) => {
            set(objPublicAPI.props.color, {r: 1, g: 2, b: 3, a: 0.5})
          })

          studio.transaction(({unset}) => {
            unset(objPublicAPI.props.color)
          })

          expect(objValues.next().value).toMatchObject({
            color: {r: 0, g: 0, b: 0, a: 1},
          })

          teardown()
        })

        test(`should disallow unsetting an override on sub-props`, async () => {
          const {teardown, objValues, studio, objPublicAPI} = await setup()
          studio.transaction(({set}) => {
            set(objPublicAPI.props.color, {r: 1, g: 2, b: 3, a: 0.5})
          })

          // TODO: also disallow in types
          expect(() => {
            studio.transaction(({unset}) => {
              unset(objPublicAPI.props.color.r)
            })
          }).toThrow()

          expect(objValues.next().value).toMatchObject({
            color: {r: 1, g: 2, b: 3, a: 0.5},
          })

          teardown()
        })
      })
    })
  })

  describe(`sequenced overrides`, () => {
    test('calculation of sequenced overrides', async () => {
      const {objPublicAPI, sheet} = await setupTestSheet({
        staticOverrides: {
          byObject: {},
        },
        sequence: {
          type: 'PositionalSequence',
          length: 20,
          subUnitsPerUnit: 30,
          tracksByObject: {
            obj: {
              trackIdByPropPath: {
                [encodePathToProp(['position', 'y'])]: asSequenceTrackId('1'),
              },
              trackData: {
                '1': {
                  type: 'BasicKeyframedTrack',
                  keyframes: [
                    {
                      id: asKeyframeId('0'),
                      position: 10,
                      connectedRight: true,
                      handles: [0.5, 0.5, 0.5, 0.5],
                      value: 3,
                    },
                    {
                      id: asKeyframeId('1'),
                      position: 20,
                      connectedRight: false,
                      handles: [0.5, 0.5, 0.5, 0.5],
                      value: 6,
                    },
                  ],
                },
              },
            },
          },
        },
      })

      const seq = sheet.publicApi.sequence

      const objValues = iterateOver(prism(() => objPublicAPI.value))

      expect(seq.position).toEqual(0)

      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 3, z: 0},
      })

      seq.position = 5
      expect(seq.position).toEqual(5)
      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 3, z: 0},
      })

      seq.position = 11
      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 3.29999747758308, z: 0},
      })

      seq.position = 15
      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 4.5, z: 0},
      })

      seq.position = 22
      expect(objValues.next().value).toMatchObject({
        position: {x: 0, y: 6, z: 0},
      })

      objValues.return()
    })
  })
})
