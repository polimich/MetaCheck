import json
import math
import numpy as np


def json_to_points(json_points, precision=1):
    return round_floats(json.loads(json_points), precision)


def json_to_np_points(str_points, precision=1, np=None):
    return np.asarray(json_to_points(str_points, precision))


def points_to_json(points, precision=1):
    return json.dumps(round_floats(points, precision))


def round_floats(obj, precision=1):
    if isinstance(obj, float):
        if math.isnan(obj):
            obj = 0
        r = round(obj, precision)
        int_r = int(r)
        if r == int_r:
            return int_r
        else:
            return r
    elif isinstance(obj, dict):
        return dict((k, round_floats(v, precision)) for k, v in obj.items())
    elif isinstance(obj, (list, tuple)):
        return list(map(lambda o: round_floats(o, precision), obj))
    if isinstance(obj, np.ndarray):
        return round_floats(obj.tolist(), precision)
    return obj 